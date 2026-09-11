"""Versioned, strict contract shared by validation, AI extraction and CP-SAT."""
from typing import Annotated, Literal, Self

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, model_validator

Identifier = Annotated[str, Field(min_length=1, max_length=160)]
Name = Annotated[str, Field(min_length=1, max_length=160)]
Day = Annotated[int, Field(ge=1, le=7)]
Period = Annotated[int, Field(ge=1, le=20)]
Minute = Annotated[int, Field(ge=0, le=1440)]


def validate_version(value: object) -> int:
    # Python bool is an int subclass; Literal[1] otherwise also accepts True.
    if type(value) is not int or value != 1:
        raise ValueError("Unsupported timetable schema version; use integer 1.")
    return value


Version = Annotated[Literal[1], BeforeValidator(validate_version)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Break(StrictModel):
    kind: Literal["rest", "lunch", "custom"]
    label: Name
    after_period: Period
    duration_minutes: Annotated[int, Field(ge=1, le=180)]


class Settings(StrictModel):
    active_days: Annotated[list[Day], Field(min_length=1, max_length=7)]
    start_minute: Minute
    periods_per_day: Period
    period_minutes: Annotated[int, Field(ge=5, le=180)]
    breaks: Annotated[list[Break], Field(max_length=8)] = Field(default_factory=list)
    no_assignment_back_to_back: bool = True
    max_teacher_consecutive: Annotated[int, Field(ge=0, le=20)] = 3

    @model_validator(mode="after")
    def valid_day(self) -> Self:
        if len(set(self.active_days)) != len(self.active_days):
            raise ValueError("Choose each active school day only once.")
        if any(b.after_period > self.periods_per_day for b in self.breaks):
            raise ValueError("A break must follow an existing period.")
        if len({b.after_period for b in self.breaks}) != len(self.breaks):
            raise ValueError("Place breaks after different periods.")
        end = self.start_minute + self.periods_per_day * self.period_minutes
        if end + sum(b.duration_minutes for b in self.breaks) > 1440:
            raise ValueError("The school day cannot run past midnight.")
        return self


class Requirement(StrictModel):
    id: Identifier
    teacher_user_id: Identifier
    teacher_name: Name
    class_id: Identifier
    class_name: Name
    subject: Name
    periods_per_week: Annotated[int, Field(ge=0, le=140)]
    max_per_day: Annotated[int, Field(ge=1, le=20)]
    allow_back_to_back: bool = False
    enabled: bool = True

    @model_validator(mode="after")
    def nonblank_subject(self) -> Self:
        if not self.subject.strip():
            raise ValueError("Subject cannot be blank.")
        return self


class Rule(StrictModel):
    id: Identifier
    description: Annotated[str, Field(min_length=1, max_length=500)]
    kind: Literal[
        "unavailable", "prefer_slots", "avoid_slots", "max_per_day",
        "max_consecutive", "allow_double", "avoid_double", "balanced_week", "lighter_day",
    ]
    scope: Literal["teacher", "class", "class_subject", "assignment"]
    teacher_user_id: Identifier | None = None
    class_id: Identifier | None = None
    subject: Name | None = None
    requirement_id: Identifier | None = None
    days: Annotated[list[Day], Field(max_length=7)] = Field(default_factory=list)
    periods: Annotated[list[Period], Field(max_length=20)] = Field(default_factory=list)
    start_minute: Minute | None = None
    end_minute: Minute | None = None
    limit: Annotated[int, Field(ge=1, le=20)] | None = None
    weight: Annotated[int, Field(ge=1, le=100)] = 1

    @model_validator(mode="after")
    def valid_shape(self) -> Self:
        if len(set(self.days)) != len(self.days) or len(set(self.periods)) != len(self.periods):
            raise ValueError("Rule days and periods must be unique.")
        slot_rule = self.kind in {"unavailable", "prefer_slots", "avoid_slots"}
        if slot_rule and not (self.days or self.periods or self.start_minute is not None or self.end_minute is not None):
            raise ValueError("A slot rule needs a day, period or time window.")
        if not slot_rule and (self.periods or self.start_minute is not None or self.end_minute is not None):
            raise ValueError("Only slot rules accept periods or time windows.")
        if self.start_minute is not None and self.end_minute is not None and self.start_minute >= self.end_minute:
            raise ValueError("Rule time window must end after it starts.")
        if (self.kind in {"max_per_day", "max_consecutive"}) != (self.limit is not None):
            raise ValueError("Only maximum rules require a numeric limit.")
        if self.kind == "max_consecutive" and (
            self.scope != "teacher" or self.class_id or self.subject or self.requirement_id
        ):
            raise ValueError("Consecutive limits apply to all lessons of each selected teacher.")
        if self.kind in {"allow_double", "avoid_double"} and self.scope != "class_subject":
            raise ValueError("Double-period rules use class_subject scope.")
        if self.kind == "lighter_day" and not self.days:
            raise ValueError("A lighter-day preference needs at least one day.")
        if self.kind == "balanced_week" and self.days:
            raise ValueError("Weekly balance uses every active school day.")
        return self


class RuleSet(StrictModel):
    schema_version: Version = 1
    hard_constraints: Annotated[list[Rule], Field(max_length=100)] = Field(default_factory=list)
    soft_preferences: Annotated[list[Rule], Field(max_length=100)] = Field(default_factory=list)
    clarification_questions: Annotated[list[Annotated[str, Field(min_length=1, max_length=500)]], Field(max_length=10)] = Field(default_factory=list)

    @model_validator(mode="after")
    def valid_strength(self) -> Self:
        rules = self.hard_constraints + self.soft_preferences
        if len({r.id for r in rules}) != len(rules):
            raise ValueError("Each AI rule needs a unique ID.")
        for rule in self.hard_constraints:
            if rule.kind in {"prefer_slots", "balanced_week", "lighter_day"}:
                raise ValueError(f"{rule.kind} is a soft preference, not a hard constraint.")
            if rule.weight != 1:
                raise ValueError("Hard rules do not have optimization weights; use 1.")
        if any(r.kind == "allow_double" for r in self.soft_preferences):
            raise ValueError("allow_double is an explicit permission; put it in hard_constraints.")
        return self


class GenerateRequest(StrictModel):
    schema_version: Version = 1
    settings: Settings
    requirements: Annotated[list[Requirement], Field(min_length=1, max_length=1000)]
    rules: RuleSet = Field(default_factory=RuleSet)
    seed: Annotated[int, Field(ge=0, le=2147483647)] = 0
    time_limit_seconds: Annotated[int, Field(ge=1, le=30)] = 15

    @model_validator(mode="after")
    def valid_references(self) -> Self:
        reqs = self.requirements
        if len({r.id for r in reqs}) != len(reqs):
            raise ValueError("Duplicate requirement IDs.")
        identities = {(r.teacher_user_id, r.class_id, r.subject.strip().lower()) for r in reqs}
        if len(identities) != len(reqs):
            raise ValueError("Duplicate teacher + class + subject assignment.")
        active = [r for r in reqs if r.enabled and r.periods_per_week > 0]
        if not active:
            raise ValueError("Enable at least one teaching requirement with weekly lessons.")
        if len(active) * len(self.settings.active_days) * self.settings.periods_per_day > 100000:
            raise ValueError("This request exceeds the scheduler's configured size limit.")
        for rule in self.rules.hard_constraints + self.rules.soft_preferences:
            if not set(rule.days).issubset(self.settings.active_days):
                raise ValueError(f"{rule.id}: rule refers to an inactive school day.")
            if any(p > self.settings.periods_per_day for p in rule.periods):
                raise ValueError(f"{rule.id}: rule refers to a period that does not exist.")
            if not any(matches(rule, r) for r in active):
                raise ValueError(f"{rule.id}: no enabled assignment matches this rule.")
        return self


def matches(rule: Rule, req: Requirement) -> bool:
    return (
        (rule.teacher_user_id is None or rule.teacher_user_id == req.teacher_user_id)
        and (rule.class_id is None or rule.class_id == req.class_id)
        and (rule.subject is None or rule.subject.strip().lower() == req.subject.strip().lower())
        and (rule.requirement_id is None or rule.requirement_id == req.id)
    )


class Lesson(StrictModel):
    requirement_id: Identifier
    teacher_user_id: Identifier
    class_id: Identifier
    subject: Name
    day_of_week: Day
    period_index: Period
    start_minute: Minute
    end_minute: Minute


class Diagnostic(StrictModel):
    code: str
    message: str
    rule_ids: list[str] = Field(default_factory=list)


class SoftViolation(StrictModel):
    rule_id: str
    description: str
    units: int
    weighted_penalty: int


class GenerateResponse(StrictModel):
    status: Literal["optimal", "feasible", "infeasible", "timeout", "needs_clarification", "invalid_result"]
    lessons: list[Lesson] = Field(default_factory=list)
    score: float | None = None
    penalty: int | None = None
    diagnostics: list[Diagnostic] = Field(default_factory=list)
    violated_soft_preferences: list[SoftViolation] = Field(default_factory=list)
    wall_time_seconds: float = 0
