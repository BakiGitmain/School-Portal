"""Boolean assignment/slot CP-SAT model and independent solution validation.

No network calls, database credentials, publication or recursive search.
Days use ISO numbering (Monday=1); periods are 1-based; times are minutes.
"""
from collections import Counter, defaultdict
from itertools import combinations

from ortools.sat.python import cp_model

from models import (
    Diagnostic, GenerateRequest, GenerateResponse, Lesson, Requirement, Rule,
    Settings, SoftViolation, matches,
)


def period_slots(settings: Settings) -> dict[int, tuple[int, int]]:
    cursor = settings.start_minute
    slots = {}
    for period in range(1, settings.periods_per_day + 1):
        slots[period] = (cursor, cursor + settings.period_minutes)
        cursor += settings.period_minutes
        cursor += sum(b.duration_minutes for b in settings.breaks if b.after_period == period)
    return slots


def slot_matches(rule: Rule, day: int, period: int, slots: dict[int, tuple[int, int]]) -> bool:
    start, end = slots[period]
    # A time rule covers any lesson overlapping the half-open time interval.
    return (
        (not rule.days or day in rule.days)
        and (not rule.periods or period in rule.periods)
        and (rule.start_minute is None or end > rule.start_minute)
        and (rule.end_minute is None or start < rule.end_minute)
    )


def group_key(req: Requirement, scope: str) -> tuple[str, ...]:
    if scope == "teacher":
        return (req.teacher_user_id,)
    if scope == "class":
        return (req.class_id,)
    if scope == "class_subject":
        return (req.class_id, req.subject.strip().lower())
    return (req.id,)


def groups(reqs: list[Requirement], scope: str, rule: Rule | None = None):
    result: dict[tuple[str, ...], list[Requirement]] = defaultdict(list)
    for req in reqs:
        if rule is None or matches(rule, req):
            result[group_key(req, scope)].append(req)
    return result.values()


def consecutive_windows(settings: Settings, maximum: int):
    # A real rest/lunch interrupts consecutive teaching, even when period
    # indexes on either side are adjacent. Free periods also interrupt runs.
    break_after = {b.after_period for b in settings.breaks}
    for start in range(1, settings.periods_per_day - maximum + 1):
        window = list(range(start, start + maximum + 1))
        if not any(p in break_after for p in window[:-1]):
            yield window


def double_allowed(req: Requirement, day: int, request: GenerateRequest) -> bool:
    return req.allow_back_to_back or any(
        r.kind == "allow_double" and matches(r, req) and (not r.days or day in r.days)
        for r in request.rules.hard_constraints
    )


def capacity_diagnostics(request: GenerateRequest) -> list[Diagnostic]:
    settings = request.settings
    slots = period_slots(settings)
    active = [r for r in request.requirements if r.enabled and r.periods_per_week]
    blocked = [r for r in request.rules.hard_constraints if r.kind in {"unavailable", "avoid_slots"}]
    available = {
        req.id: {(d, p) for d in settings.active_days for p in slots if not any(
            matches(rule, req) and slot_matches(rule, d, p, slots) for rule in blocked
        )} for req in active
    }
    issues = []
    for req in active:
        capacity = sum(min(req.max_per_day, sum(d == day for d, _ in available[req.id]))
                       for day in settings.active_days)
        if req.periods_per_week > capacity:
            issues.append(Diagnostic(code="assignment_capacity", message=(
                f"{req.subject} for {req.class_name} with {req.teacher_name} requires "
                f"{req.periods_per_week} weekly periods, but Max / Day = {req.max_per_day} "
                f"across {len(settings.active_days)} active days and availability allow only {capacity}."
            )))
    for scope in ("teacher", "class"):
        for group in groups(active, scope):
            total = sum(r.periods_per_week for r in group)
            capacity = len(set().union(*(available[r.id] for r in group)))
            if total > capacity:
                name = group[0].teacher_name if scope == "teacher" else group[0].class_name
                issues.append(Diagnostic(code=f"{scope}_capacity", message=(
                    f"{name} needs {total} weekly lessons but only {capacity} {scope} slots are available."
                )))
    return issues


def rule_units(rule: Rule, lessons: list[Lesson], request: GenerateRequest) -> int:
    """Evaluate a rule against plain lessons, independently of the CP model."""
    reqs = [r for r in request.requirements if r.enabled and matches(rule, r)]
    req_ids = {r.id for r in reqs}
    chosen = [e for e in lessons if e.requirement_id in req_ids]
    slots = period_slots(request.settings)
    days = rule.days or request.settings.active_days
    if rule.kind in {"unavailable", "avoid_slots", "prefer_slots"}:
        # For prefer_slots, days are preferred days, not a filter on the scope.
        return sum(slot_matches(rule, e.day_of_week, e.period_index, slots)
                   != (rule.kind == "prefer_slots") for e in chosen)
    if rule.kind == "allow_double":
        return 0
    if rule.kind == "lighter_day":
        return sum(e.day_of_week in days for e in chosen)
    units = 0
    for group in groups(reqs, rule.scope):
        ids = {r.id for r in group}
        entries = [e for e in chosen if e.requirement_id in ids]
        counts = Counter(e.day_of_week for e in entries)
        if rule.kind == "balanced_week":
            units += sum(abs(counts[d1] - counts[d2]) for d1, d2 in combinations(days, 2))
        elif rule.kind == "max_per_day":
            units += sum(max(0, counts[d] - rule.limit) for d in days)
        elif rule.kind in {"max_consecutive", "avoid_double"}:
            maximum = rule.limit if rule.kind == "max_consecutive" else 1
            for day in days:
                periods = {e.period_index for e in entries if e.day_of_week == day}
                units += sum(all(p in periods for p in w)
                             for w in consecutive_windows(request.settings, maximum))
    return units


def validate_lessons(request: GenerateRequest, lessons: list[Lesson]) -> list[str]:
    """Never release a CP-SAT result that fails these independent hard checks."""
    errors = []
    reqs = {r.id: r for r in request.requirements if r.enabled and r.periods_per_week}
    slots = period_slots(request.settings)
    teacher_slots, class_slots = set(), set()
    counts, daily = Counter(), Counter()
    for entry in lessons:
        req = reqs.get(entry.requirement_id)
        if req is None:
            errors.append("Unknown or disabled assignment in result.")
            continue
        if (entry.teacher_user_id, entry.class_id, entry.subject) != (req.teacher_user_id, req.class_id, req.subject):
            errors.append("Assignment identity changed in result.")
        if entry.day_of_week not in request.settings.active_days or entry.period_index not in slots:
            errors.append("Lesson outside active school days or valid periods.")
            continue
        if (entry.start_minute, entry.end_minute) != slots[entry.period_index]:
            errors.append("Lesson times do not match configuration.")
        teacher_key = (entry.teacher_user_id, entry.day_of_week, entry.period_index)
        class_key = (entry.class_id, entry.day_of_week, entry.period_index)
        if teacher_key in teacher_slots:
            errors.append("Teacher collision.")
        if class_key in class_slots:
            errors.append("Class collision.")
        teacher_slots.add(teacher_key)
        class_slots.add(class_key)
        counts[req.id] += 1
        daily[req.id, entry.day_of_week] += 1
    for req in reqs.values():
        if counts[req.id] != req.periods_per_week:
            errors.append(f"Weekly requirement not met: {req.id}.")
        if any(daily[req.id, d] > req.max_per_day for d in request.settings.active_days):
            errors.append(f"Assignment daily maximum exceeded: {req.id}.")
    if errors:
        return errors
    if request.settings.no_assignment_back_to_back:
        by_class_slot = {(e.class_id, e.day_of_week, e.period_index): e for e in lessons}
        break_after = {b.after_period for b in request.settings.breaks}
        for e in lessons:
            next_entry = by_class_slot.get((e.class_id, e.day_of_week, e.period_index + 1))
            if next_entry and e.period_index not in break_after and e.subject.strip().lower() == next_entry.subject.strip().lower():
                if not all(double_allowed(reqs[x.requirement_id], e.day_of_week, request) for x in (e, next_entry)):
                    errors.append("Back-to-back subject lessons without permission.")
    hard = list(request.rules.hard_constraints)
    if request.settings.max_teacher_consecutive:
        hard.append(Rule(id="settings-consecutive", description="Teacher consecutive limit", kind="max_consecutive",
                         scope="teacher", limit=request.settings.max_teacher_consecutive))
    for rule in hard:
        if rule_units(rule, lessons, request):
            errors.append(f"Hard rule violated: {rule.id}.")
    return errors


def generate(request: GenerateRequest) -> GenerateResponse:
    if request.rules.clarification_questions:
        return GenerateResponse(status="needs_clarification", diagnostics=[
            Diagnostic(code="clarification", message=q) for q in request.rules.clarification_questions
        ])
    issues = capacity_diagnostics(request)
    if issues:
        return GenerateResponse(status="infeasible", diagnostics=issues)
    settings = request.settings
    reqs = [r for r in request.requirements if r.enabled and r.periods_per_week]
    slots = period_slots(settings)
    days = settings.active_days
    model = cp_model.CpModel()
    x = {(r.id, d, p): model.new_bool_var(f"{i}:{d}:{p}")
         for i, r in enumerate(reqs) for d in days for p in slots}
    assumptions = {}

    def assumption(label: str, rule_id: str | None = None):
        flag = model.new_bool_var(f"a{len(assumptions)}")
        model.add_assumption(flag)
        assumptions[flag.index] = (label, rule_id)
        return flag

    for r in reqs:
        flag = assumption(f"{r.class_name}: {r.subject} with {r.teacher_name} needs {r.periods_per_week} periods/week.")
        model.add(sum(x[r.id, d, p] for d in days for p in slots) == r.periods_per_week).only_enforce_if(flag)
        for d in days:
            model.add(sum(x[r.id, d, p] for p in slots) <= r.max_per_day)
    for scope in ("class", "teacher"):
        for group in groups(reqs, scope):
            for d in days:
                for p in slots:
                    model.add(sum(x[r.id, d, p] for r in group) <= 1)
    if settings.no_assignment_back_to_back:
        for group in groups(reqs, "class_subject"):
            for d in days:
                restricted = [r for r in group if not double_allowed(r, d, request)]
                for p, nxt in consecutive_windows(settings, 1):
                    # A permission on one assignment never relaxes another teacher's restriction.
                    for r in restricted:
                        model.add(x[r.id, d, p] + sum(x[t.id, d, nxt] for t in group) <= 1)
                        model.add(x[r.id, d, nxt] + sum(x[t.id, d, p] for t in group) <= 1)

    penalties = []

    def at_most(expression, limit, flag, weight, bound):
        if flag is not None:
            model.add(expression <= limit).only_enforce_if(flag)
        else:
            excess = model.new_int_var(0, bound, f"penalty{len(penalties)}")
            model.add_max_equality(excess, [0, expression - limit])
            penalties.append(excess * weight)

    def add_rule(rule: Rule, hard: bool):
        selected = [r for r in reqs if matches(rule, r)]
        selected_days = rule.days or days
        if rule.kind == "allow_double":
            return  # Used only by the baseline double-period permission above.
        flag = assumption(rule.description, rule.id) if hard else None
        weight = rule.weight
        if rule.kind in {"unavailable", "avoid_slots", "prefer_slots", "lighter_day"}:
            terms = []
            for r in selected:
                for d in days:
                    for p in slots:
                        bad = d in selected_days if rule.kind == "lighter_day" else (
                            slot_matches(rule, d, p, slots) != (rule.kind == "prefer_slots"))
                        if bad:
                            terms.append(x[r.id, d, p])
            at_most(sum(terms), 0, flag, weight, len(terms))
            return
        for group in groups(selected, rule.scope):
            daily = {d: sum(x[r.id, d, p] for r in group for p in slots) for d in days}
            if rule.kind == "max_per_day":
                for d in selected_days:
                    at_most(daily[d], rule.limit, flag, weight, len(slots))
            elif rule.kind in {"max_consecutive", "avoid_double"}:
                maximum = rule.limit if rule.kind == "max_consecutive" else 1
                for d in selected_days:
                    for window in consecutive_windows(settings, maximum):
                        at_most(sum(x[r.id, d, p] for r in group for p in window), maximum, flag, weight, 1)
            elif rule.kind == "balanced_week":
                for d1, d2 in combinations(days, 2):
                    difference = model.new_int_var(0, len(slots), f"balance{len(penalties)}")
                    model.add_abs_equality(difference, daily[d1] - daily[d2])
                    penalties.append(difference * weight)

    if settings.max_teacher_consecutive:
        add_rule(Rule(id="settings-consecutive", description="Maximum consecutive teacher periods from Basic Settings",
                      kind="max_consecutive", scope="teacher", limit=settings.max_teacher_consecutive), True)
    for rule in request.rules.hard_constraints:
        add_rule(rule, True)
    for rule in request.rules.soft_preferences:
        add_rule(rule, False)
    if penalties:
        model.minimize(sum(penalties))
    validation = model.validate()
    if validation:
        return GenerateResponse(status="invalid_result", diagnostics=[Diagnostic(
            code="model_invalid", message="The scheduling model could not be validated. Contact support."
        )])
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = request.time_limit_seconds
    solver.parameters.random_seed = request.seed
    # Single worker is deterministic for tests and bounded per HTTP worker.
    solver.parameters.num_search_workers = 1
    status = solver.solve(model)
    elapsed = solver.wall_time
    if status == cp_model.INFEASIBLE:
        core = [assumptions[i] for i in solver.sufficient_assumptions_for_infeasibility() if i in assumptions]
        return GenerateResponse(status="infeasible", wall_time_seconds=elapsed, diagnostics=[Diagnostic(
            code="conflicting_requirements",
            message=("These requirements cannot currently fit into the available periods. "
                     "Try adding a school day, increasing periods per day, or reducing a weekly requirement. "
                     "Conflicting conditions include: " + " ".join(label for label, _ in core[:12])),
            rule_ids=[rid for _, rid in core if rid],
        )])
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return GenerateResponse(status="timeout", wall_time_seconds=elapsed, diagnostics=[Diagnostic(
            code="search_timeout", message="The search reached its time limit before finding a schedule. "
            "This does not prove the requirements are impossible. Try again or simplify the conditions."
        )])
    lessons = [Lesson(requirement_id=r.id, teacher_user_id=r.teacher_user_id, class_id=r.class_id,
                      subject=r.subject, day_of_week=d, period_index=p,
                      start_minute=slots[p][0], end_minute=slots[p][1])
               for r in reqs for d in days for p in slots if solver.value(x[r.id, d, p])]
    errors = validate_lessons(request, lessons)
    if errors:
        return GenerateResponse(status="invalid_result", wall_time_seconds=elapsed, diagnostics=[Diagnostic(
            code="validation_failed", message="The generated schedule failed an internal safety check. Please contact support."
        )])
    violations = []
    for rule in request.rules.soft_preferences:
        units = rule_units(rule, lessons, request)
        if units:
            violations.append(SoftViolation(rule_id=rule.id, description=rule.description,
                                            units=units, weighted_penalty=units * rule.weight))
    penalty = sum(v.weighted_penalty for v in violations)
    # This is a documented penalty indicator, not an invented percentage of optimality.
    return GenerateResponse(status="optimal" if status == cp_model.OPTIMAL else "feasible",
                            lessons=lessons, score=100.0 / (1 + penalty), penalty=penalty,
                            violated_soft_preferences=violations, wall_time_seconds=elapsed)
