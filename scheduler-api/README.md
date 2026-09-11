# Timetable scheduler — phase 2

Small FastAPI service using real Google OR-Tools CP-SAT. It receives structured requirements/rules, returns validated lessons, and never connects to Supabase or publishes a schedule. OpenAI interpretation belongs to the Edge Function. The Expo app is not switched over until manual backend setup is confirmed.

## Run locally

Use Python 3.12. From `D:\student-portal\scheduler-api` in PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
$env:SCHEDULER_API_KEY = '<a random secret of at least 32 characters>'
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
```

If the repository-local `.venv` already exists from development, reuse it. The development environment was created with `uv`; use `uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt` for reinstalling dependencies, or run `.venv/Scripts/python.exe -m ensurepip` before using pip. Linux/macOS use `.venv/bin/python`. Production installs only `requirements.txt`. The `.in` files describe direct dependencies; `.txt` files pin the resolved versions. No changes to Expo's dependencies are needed.

In a second terminal with the same `SCHEDULER_API_KEY`:

```powershell
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/health'
$headers = @{ Authorization = "Bearer $env:SCHEDULER_API_KEY" }
$sample = Get-Content -Raw .\sample.json
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/generate' -Headers $headers -ContentType 'application/json' -Body $sample
```

The sample contains two teachers teaching Physics to the same class, plus one teacher teaching a second class. Its IDs are fictitious and suitable only for the standalone service. The Edge Function requires real saved school assignment IDs.

## Endpoints

| Method/path | Access | Behavior |
| --- | --- | --- |
| POST /health | public | Liveness and contract version; no school data |
| POST /generate | shared server secret | CP-SAT result, diagnostics and soft penalties |
| POST /validate-context | shared server secret | Strictly validates settings/requirements; rejects old AI rules |
| POST /rule-schema | shared server secret | Strict JSON schema derived from the same Pydantic rule models |
| POST /validate-rules | shared server secret | Validates rule shapes, strength, IDs and scheduling references |

All timetable endpoints use `Authorization: Bearer <SCHEDULER_API_KEY>`. There is no Supabase service-role credential here. The secret must never be an `EXPO_PUBLIC_*` variable. Missing/short server keys fail closed with 503. Invalid credentials receive 401. Invalid configuration receives 422 with safe field diagnostics. Requests over 1 MB receive 413; only one generation per process runs at a time, with 429 for a concurrent request.

## Contract and scheduling behavior

The full request contract is `GenerateRequest` in `models.py`; `sample.json` is runnable. Fields use snake_case for easy mapping to existing database fields. `schema_version=1`. ISO weekdays Monday=1 through Sunday=7; periods start at 1; international minutes after midnight are the only stored time representation. Display formats stay in Expo/version presentation metadata, not the solver.

Each requirement has its own ID and teacher + class + normalized subject identity. Duplicate triples/IDs are rejected; different teachers teaching the same class/subject are valid. Disabled/zero-period requirements are not scheduled. Weekly counts, individual daily maximums, teacher/class collisions, active days, valid periods and exact times are checked twice: in CP-SAT and by a separate plain-data validator.

Breaks are gaps between lesson periods, never selectable lesson slots. A real break or a free period interrupts consecutive teaching. Rest/lunch cannot occupy the same break position. A day cannot run past midnight. Current explicit service bounds: 1–7 active days, 1–16 periods/day, up to 1,000 requirements and 100,000 assignment-slot variables, 100 hard plus 100 soft rules, 1–30 seconds of solver search. These are validation/resource limits, not a promise every school of that size solves within the time limit.

### Rules

Selectors `teacher_user_id`, `class_id`, `subject`, `requirement_id` intersect; null selects all. `scope` determines aggregation (`teacher`, `class`, `class_subject`, `assignment`). A class-subject daily limit includes both teachers when they share that subject/class. Empty day/period arrays select all active days/periods.

| Kind | Meaning |
| --- | --- |
| unavailable / avoid_slots | Forbid matching slots if hard, penalize them if soft |
| prefer_slots | Soft penalty for lessons outside the requested slot window |
| max_per_day | Hard or soft daily maximum per selected group |
| max_consecutive | Hard or soft consecutive maximum per teacher, across all their lessons |
| allow_double | Explicit permission for selected assignments; does not force pairs |
| avoid_double | Hard or soft restriction on adjacent same-subject class lessons |
| balanced_week | Soft sum of pairwise differences between daily group loads |
| lighter_day | Soft cost per selected lesson on selected days |

Time windows are half-open and cover any overlapping lesson; this prevents a lesson straddling a teacher's unavailable start/end time. Days, periods and windows intersect. For `prefer_slots`, days form part of the preferred window; outside days are penalized too. A hard `avoid_double` takes precedence over permission. Per-assignment back-to-back permission alone does not waive the other teacher's restriction.

Base constraints are never relaxed. Soft rules minimize weighted penalties; their violations are returned with descriptions and units. `score=100/(1+weighted_penalty)` is a display indicator, **not a percentage of optimality** and not comparable to the previous homemade solver score. `optimal` proves minimum penalty for this model; `feasible` is a valid schedule without proof of optimality. `timeout` is not proof of infeasibility. `infeasible` returns capacity diagnostics or a sufficient conflicting set (not necessarily minimal). Internal validation failure returns no lessons.

Unknown/ambiguous AI references require clarification; generation is blocked while clarification questions remain. Mandatory double blocks, room allocation and other unsupported semantics must be clarified, not silently approximated. `seed` supports repeatable runs; regeneration may return the same schedule when appropriate and never changes persisted data.

## Hosting manually

Deploy this directory on a Python/container host you control. The provided Dockerfile runs a non-root user and one Uvicorn worker. Configure HTTPS at your host/reverse proxy, the `SCHEDULER_API_KEY` secret, a 1 MB proxy body limit, request timeout and rate limits. Do not expose the shared key in browser/mobile code. Configure the Edge Function's `SCHEDULER_URL` to the HTTPS origin (no path). Restrict network ingress to your backend infrastructure where your host supports it.

The in-process concurrency bound is per worker/replica. Start with one worker; a larger deployment needs ingress-wide rate/concurrency limits. Apply a rate limit to timetable AI invocations before production rollout, along with OpenAI project spending limits. No hosting account was selected or deployed by Codex.

## References

- [Google CP-SAT and result statuses](https://developers.google.com/optimization/cp/cp_solver)
- [Google employee scheduling model](https://developers.google.com/optimization/scheduling/employee_scheduling)
- [Pydantic strict validation](https://pydantic.dev/docs/validation/latest/concepts/strict_mode/)
