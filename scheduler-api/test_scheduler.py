from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from main import app, generation_slot, rule_schema
from models import GenerateRequest, Lesson, Rule, RuleSet, Settings
from scheduler import generate, period_slots, rule_units, validate_lessons


def assignment(id="r1", teacher="daniel", classroom="10A", subject="Physics", weekly=3, maximum=1):
    return {"id": id, "teacher_user_id": teacher, "teacher_name": teacher.title(),
            "class_id": classroom, "class_name": classroom, "subject": subject,
            "periods_per_week": weekly, "max_per_day": maximum, "allow_back_to_back": True}


def payload(requirements=None, **settings):
    return {"settings": {"active_days": [1, 2, 3, 4, 5], "start_minute": 480,
                         "periods_per_day": 7, "period_minutes": 45,
                         "breaks": [{"kind": "rest", "label": "Rest", "after_period": 3, "duration_minutes": 20},
                                    {"kind": "lunch", "label": "Lunch", "after_period": 5, "duration_minutes": 45}],
                         **settings}, "requirements": requirements or [assignment()]}


def with_rules(data, hard=(), soft=()):
    data["rules"] = {"hard_constraints": [r.model_dump() for r in hard],
                     "soft_preferences": [r.model_dump() for r in soft]}
    return GenerateRequest.model_validate(data)


def rule(kind="unavailable", **kwargs):
    return Rule(id=kwargs.pop("id", kind), description=f"Test {kind}", kind=kind,
                scope=kwargs.pop("scope", "teacher"), **kwargs)


def solved(request):
    result = generate(request)
    assert result.status in {"optimal", "feasible"}, result
    assert not validate_lessons(request, result.lessons)
    return result


def test_exact_periods_rest_lunch_and_free_slots():
    req = GenerateRequest.model_validate(payload())
    assert list(period_slots(req.settings).values()) == [
        (480, 525), (525, 570), (570, 615), (635, 680), (680, 725), (770, 815), (815, 860)]
    result = solved(req)
    assert len(result.lessons) == 3  # Free periods stay empty, never fabricated lessons.
    assert all(e.day_of_week in [1, 2, 3, 4, 5] for e in result.lessons)


def test_assignment_identity_and_collisions_across_classes():
    req = GenerateRequest.model_validate(payload([
        assignment(), assignment("r2", "hana"), assignment("r3", "daniel", "9A"),
        assignment("r4", "ruth", "10A", "Chemistry")]))
    result = solved(req)
    assert len(result.lessons) == 12
    for e in result.lessons:
        assert sum(x.teacher_user_id == e.teacher_user_id and x.day_of_week == e.day_of_week
                   and x.period_index == e.period_index for x in result.lessons) == 1
        assert sum(x.class_id == e.class_id and x.day_of_week == e.day_of_week
                   and x.period_index == e.period_index for x in result.lessons) == 1
    assert {e.requirement_id for e in result.lessons} == {"r1", "r2", "r3", "r4"}


def test_teacher_time_and_class_availability():
    req = with_rules(payload(), hard=[
        rule(teacher_user_id="daniel", days=[1], periods=[1], id="monday"),
        rule(teacher_user_id="daniel", end_minute=600, id="before10"),
        rule(scope="class", class_id="10A", days=[2], id="class_closed")])
    result = solved(req)
    assert all(e.start_minute >= 600 and e.day_of_week != 2 for e in result.lessons)


def test_hard_consecutive_respects_breaks():
    data = payload([assignment(weekly=4, maximum=4)], active_days=[1], periods_per_day=4,
                   max_teacher_consecutive=2, breaks=[{"kind": "rest", "label": "Rest", "after_period": 2, "duration_minutes": 20}])
    assert len(solved(GenerateRequest.model_validate(data)).lessons) == 4
    data["settings"]["breaks"] = []
    assert generate(GenerateRequest.model_validate(data)).status == "infeasible"


def test_subject_daily_limit_combines_different_teachers():
    req = with_rules(payload([assignment(weekly=2), assignment("r2", "hana", weekly=2)],
                             active_days=[1, 2, 3]), hard=[
        rule("max_per_day", scope="class_subject", class_id="10A", subject="Physics", limit=1)])
    result = generate(req)
    assert result.status == "infeasible"
    assert "max_per_day" in result.diagnostics[0].rule_ids


def test_double_permission_does_not_override_explicit_hard_avoid():
    data = payload([assignment(weekly=2, maximum=2)], active_days=[1], periods_per_day=2,
                   breaks=[], max_teacher_consecutive=0)
    data["requirements"][0]["allow_back_to_back"] = False
    assert generate(GenerateRequest.model_validate(data)).status == "infeasible"
    allow = rule("allow_double", scope="class_subject", subject="Physics")
    solved(with_rules(data, hard=[allow]))
    avoid = rule("avoid_double", scope="class_subject", subject="Physics")
    assert generate(with_rules(data, hard=[allow, avoid])).status == "infeasible"


@pytest.mark.parametrize("kind,kwargs", [
    ("prefer_slots", {"periods": [1]}), ("avoid_slots", {"periods": [2]}),
    ("unavailable", {"periods": [2]}), ("max_per_day", {"limit": 1}),
    ("max_consecutive", {"limit": 1}), ("balanced_week", {}),
    ("lighter_day", {"days": [5]}), ("avoid_double", {"scope": "class_subject"}),
])
def test_soft_rules_have_consistent_penalties(kind, kwargs):
    req = with_rules(payload([assignment(weekly=7, maximum=3)]), soft=[rule(kind, **kwargs)])
    result = solved(req)
    expected = rule_units(req.rules.soft_preferences[0], result.lessons, req)
    assert result.penalty == expected
    assert result.score == 100 / (1 + expected)


def test_soft_rule_relaxes_instead_of_blocking_a_hard_requirement():
    req = with_rules(payload([assignment(weekly=2, maximum=2)], active_days=[5], periods_per_day=2,
                             breaks=[], max_teacher_consecutive=0), soft=[rule("lighter_day", days=[5], weight=9)])
    result = solved(req)
    assert result.penalty == 18
    assert result.violated_soft_preferences[0].units == 2


def test_preferred_morning_and_after_lunch_are_actually_optimized():
    morning = rule("prefer_slots", end_minute=570)
    first = with_rules(payload(), soft=[morning])
    result = solved(first)
    assert result.penalty == 0
    assert all(e.end_minute <= 570 for e in result.lessons)
    after_lunch = rule("prefer_slots", start_minute=770)
    second = with_rules(payload(), soft=[after_lunch])
    result = solved(second)
    assert result.penalty == 0
    assert all(e.start_minute >= 770 for e in result.lessons)


def test_all_seven_days_and_disabled_requirements():
    disabled = assignment("disabled", "other", "9A", weekly=100)
    disabled["enabled"] = False
    req = GenerateRequest.model_validate(payload([assignment(weekly=7), disabled], active_days=[1, 2, 3, 4, 5, 6, 7]))
    result = solved(req)
    assert {e.day_of_week for e in result.lessons} == {1, 2, 3, 4, 5, 6, 7}
    assert all(e.requirement_id != "disabled" for e in result.lessons)


def test_same_subject_pair_across_teachers_needs_both_permissions():
    first, second = assignment(weekly=1), assignment("r2", "hana", weekly=1)
    first["allow_back_to_back"] = False
    data = payload([first, second], active_days=[1], periods_per_day=2, breaks=[], max_teacher_consecutive=0)
    assert generate(GenerateRequest.model_validate(data)).status == "infeasible"
    first["allow_back_to_back"] = True
    assert len(solved(GenerateRequest.model_validate(data)).lessons) == 2


@pytest.mark.parametrize("reqs,settings,code", [
    ([assignment(weekly=6)], {}, "assignment_capacity"),
    ([assignment(weekly=4, maximum=4), assignment("r2", "daniel", "9A", weekly=4, maximum=4)],
     {"active_days": [1]}, "teacher_capacity"),
    ([assignment(weekly=4, maximum=4), assignment("r2", "hana", weekly=4, maximum=4)],
     {"active_days": [1]}, "class_capacity"),
])
def test_capacity_diagnostics(reqs, settings, code):
    result = generate(GenerateRequest.model_validate(payload(reqs, **settings)))
    assert result.status == "infeasible"
    assert code in {d.code for d in result.diagnostics}
    assert not result.lessons


@pytest.mark.parametrize("change", [
    {"active_days": [1, 1]}, {"active_days": [0]}, {"periods_per_day": 0},
    {"start_minute": 1400}, {"periods_per_day": True}, {"periods_per_day": "7"},
])
def test_invalid_settings_are_rejected(change):
    with pytest.raises(ValidationError):
        GenerateRequest.model_validate(payload(**change))


@pytest.mark.parametrize("version", [True, False, "1", 1.0, 2])
def test_schema_version_must_be_the_exact_integer(version):
    with pytest.raises(ValidationError):
        GenerateRequest.model_validate({**payload(), "schema_version": version})
    with pytest.raises(ValidationError):
        RuleSet.model_validate({"schema_version": version})


def test_unknown_rule_entity_invalid_period_inactive_day_and_duplicate_assignment():
    for r in [rule(teacher_user_id="missing", days=[1]), rule(periods=[8]), rule(days=[7])]:
        with pytest.raises(ValidationError):
            with_rules(payload(), hard=[r])
    with pytest.raises(ValidationError):
        GenerateRequest.model_validate(payload([assignment(), assignment("r2")]))
    with pytest.raises(ValidationError):
        Rule.model_validate({**rule(days=[1]).model_dump(), "sql": "anything"})


def test_clarification_prevents_generation():
    data = payload()
    data["rules"] = {"clarification_questions": ["Which Daniel do you mean?"]}
    assert generate(GenerateRequest.model_validate(data)).status == "needs_clarification"


@pytest.mark.parametrize("mutation", ["teacher", "class", "time", "day", "period", "count", "disabled", "identity"])
def test_independent_validator_rejects_corrupt_result(mutation):
    req = GenerateRequest.model_validate(payload([assignment(), assignment("r2", "hana", "9A")]))
    entries = deepcopy(solved(req).lessons)
    if mutation in {"teacher", "class", "count"}:
        entries.append(entries[0])
    elif mutation == "time":
        entries[0] = entries[0].model_copy(update={"start_minute": 1})
    elif mutation == "day":
        entries[0] = entries[0].model_copy(update={"day_of_week": 7})
    elif mutation == "period":
        entries[0] = entries[0].model_copy(update={"period_index": 8})
    elif mutation == "disabled":
        entries[0] = entries[0].model_copy(update={"requirement_id": "unknown"})
    else:
        entries[0] = entries[0].model_copy(update={"teacher_user_id": "unknown"})
    assert validate_lessons(req, entries)


def test_independent_validator_enforces_ai_rules_and_base_consecutive_limits():
    data = payload([assignment(weekly=2, maximum=2)], active_days=[1], periods_per_day=3,
                   breaks=[], max_teacher_consecutive=1)
    request = GenerateRequest.model_validate(data)
    def lesson(period):
        start, end = period_slots(request.settings)[period]
        return Lesson(requirement_id="r1", teacher_user_id="daniel", class_id="10A", subject="Physics",
                      day_of_week=1, period_index=period, start_minute=start, end_minute=end)
    consecutive = [lesson(1), lesson(2)]
    assert any("Hard rule" in message for message in validate_lessons(request, consecutive))
    data["settings"]["max_teacher_consecutive"] = 0
    for hard in [rule(days=[1], periods=[1]), rule("max_per_day", limit=1),
                 rule("avoid_double", scope="class_subject")]:
        request = with_rules(data, hard=[hard])
        assert any("Hard rule" in message for message in validate_lessons(request, consecutive))


def test_hard_rule_types_cannot_silently_become_preferences():
    with pytest.raises(ValidationError):
        RuleSet(hard_constraints=[rule("prefer_slots", days=[1])])
    with pytest.raises(ValidationError):
        RuleSet(soft_preferences=[rule("allow_double", scope="class_subject")])
    with pytest.raises(ValidationError):
        RuleSet(hard_constraints=[rule(days=[1], weight=100)])


def test_regenerate_is_stateless_and_retains_inputs():
    data = payload()
    original = deepcopy(data)
    req = GenerateRequest.model_validate(data)
    first, second = solved(req), solved(req)
    assert first.lessons == second.lessons
    assert data == original


def test_representative_school():
    # 12 classes, 12 teachers, 6 assignments/class, 288 weekly lessons.
    reqs = [assignment(f"r{c}-{s}", f"t{(c+s) % 12}", f"class{c}", f"Subject{s}", weekly=4)
            for c in range(12) for s in range(6)]
    req = GenerateRequest.model_validate(payload(reqs))
    result = solved(req)
    assert len(result.lessons) == 288


def test_api_auth_validation_limits_and_health(monkeypatch):
    client = TestClient(app)
    monkeypatch.delenv("SCHEDULER_API_KEY", raising=False)
    assert client.post("/health").json()["engine"] == "ortools-cp-sat"
    assert client.post("/generate", json=payload()).status_code == 503
    monkeypatch.setenv("SCHEDULER_API_KEY", "x" * 40)
    assert client.post("/generate", json=payload()).status_code == 401
    headers = {"Authorization": "Bearer " + "x" * 40}
    assert client.post("/generate", json=payload(), headers=headers).json()["status"] == "optimal"
    assert client.post("/generate", json=payload(periods_per_day="7"), headers=headers).status_code == 422
    assert client.post("/generate", content="x" * 1_000_001, headers=headers).status_code == 413
    generation_slot.acquire()
    try:
        assert client.post("/generate", json=payload(), headers=headers).status_code == 429
    finally:
        generation_slot.release()
    context = client.post("/validate-context", json=payload(), headers=headers)
    assert context.status_code == 200
    assert client.post("/validate-rules", json=context.json(), headers=headers).json()["status"] == "valid"


def test_ai_schema_has_no_optional_object_keys():
    def check(node):
        if isinstance(node, dict):
            if node.get("type") == "object":
                assert node["additionalProperties"] is False
                assert set(node["required"]) == set(node["properties"])
            assert "default" not in node
            for value in node.values():
                check(value)
        elif isinstance(node, list):
            for value in node:
                check(value)
    check(rule_schema())
