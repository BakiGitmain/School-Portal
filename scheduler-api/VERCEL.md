# Scheduler-only Vercel deployment

Vercel is the selected scheduler host. Create a **separate Vercel project** from the existing `BakiGitmain/School-Portal` GitHub repository, using `scheduler-api` as its Root Directory. Keep the existing portal's Vercel project and settings intact. No new repository is needed.

The Supabase database, Auth, Edge Function, tables, RPCs and Expo application are unchanged by this hosting setup. This service remains a private HTTP scheduler called by the Supabase Edge Function. It does not save or publish school data.

## Compatibility checked

Reviewed against Vercel's official documentation on September 11, 2026:

| Requirement | Deployment behavior |
| --- | --- |
| Python | `.python-version` selects the supported Python 3.12 runtime. |
| FastAPI | The `fastapi` preset detects the existing `main.py` and exported `app`. No wrapper or path rewrite is needed. |
| OR-Tools | All 22 pinned production dependencies have CPython 3.12-compatible Linux x86_64 wheels. Their uncompressed wheel contents total 191,041,460 bytes, including OR-Tools, NumPy and pandas. This is a dependency-size check, not the final Vercel bundle measurement. The hosted build must still verify native-library loading and final bundle size. |
| POST /health | Same route and response: `ok`, schema version 1, `ortools-cp-sat`. Browser GET returns 405 by design. |
| POST /generate | Same request, collision checks, rule validation and response. The solver searches for 15 seconds by default, at most 30 seconds. `vercel.json` allows 60 seconds for the complete function invocation. |
| SCHEDULER_API_KEY | Set as a private Vercel project environment variable. The existing service rejects absent/short configuration and invalid caller keys. |
| HTTPS | Use the stable production `https://<project>.vercel.app` domain supplied by Vercel. |

The helper POST routes `/validate-context`, `/validate-rules` and `/rule-schema` are preserved too. The service writes no persistent files, starts no detached work, and keeps no school data between requests. Its semaphore limits one generation per Python process; Vercel may run multiple processes/instances, so this is not a global concurrency limit.

The documented standard Python bundle limit is 500 MB. Fluid compute on Hobby allows up to 300 seconds and provides 2 GB memory / 1 vCPU. This setup deliberately uses a 60-second limit and the existing single-worker solver. Large-functions beta is not required based on the dependency measurement. Very large models can still exceed a runtime or memory budget; the existing 40-second Edge Function scheduler-call timeout also applies. Benchmark real school requirements after the hosted sample passes. Do not claim that every school-scale request is guaranteed to finish.

Hobby is free for eligible personal, non-commercial use within its quotas. Vercel directs professional/business use to Pro. Do not assume a live school deployment qualifies for Hobby simply because the test does. CPU-intensive generation consumes the account's included compute usage.

## Files

- `vercel.json`: native FastAPI preset, Fluid compute, 60-second function budget, bundle exclusions.
- `.python-version`: Python 3.12.
- `.vercelignore`: excludes local virtual environments, secrets and development files from CLI uploads.
- `requirements.txt`: existing pinned production dependencies; no package versions changed.
- `Dockerfile`: retained for local/container fallback; Vercel's FastAPI deployment does not use it.

## Guided manual deployment

These are reference settings. Complete them one step at a time with the assistant. Nothing has been deployed automatically, and no new secrets have been set by Codex.

1. Commit and push **only the scheduler deployment files** when ready. Leave unfinished Expo/Supabase work unstaged.
2. In Vercel, choose **Add New → Project** and import `BakiGitmain/School-Portal` again as a separate project named `school-timetable-scheduler` (or an available variant).
3. Set **Root Directory** to `scheduler-api`. Keep **Include source files outside of the Root Directory in the Build Step** disabled. Use the **FastAPI** framework preset. Leave install/build/output-directory overrides unset; Vercel installs `requirements.txt` and serves `main.py:app` itself. Do not enter an npm build, Docker command, or Uvicorn start command.
4. Add **SCHEDULER_API_KEY** to this scheduler project's **Production** environment, with the same private key used for the scheduler test. Use at least 32 random characters. Do not share it in chat, commit it, or use an `EXPO_PUBLIC_` prefix. This service does not need OpenAI or Supabase credentials.
5. Deploy manually and inspect the build log. It must use Python 3.12, install the existing requirements, load OR-Tools successfully, and finish within the standard bundle limit.
6. Use the stable production domain for the tests below. Vercel's login-based Deployment Protection must allow server-to-server access to that production domain. Keep preview deployments protected. If a response is an HTML login screen/redirect, review protection on **this scheduler project only**; the existing `SCHEDULER_API_KEY` guard continues to protect scheduling endpoints. No Edge Function bypass-header changes are part of this setup.

## Hosted acceptance checkpoint

Run tests from PowerShell, not by clicking POST endpoint URLs in a browser. The assistant will supply one command at a time after the real production URL is known.

- POST `/health`: 200 and the expected engine/version.
- POST `/generate` without Authorization: 401.
- POST `/generate` with a wrong key: 401.
- POST `/generate` with the correct key and local `sample.json`: `optimal` or `feasible`, 11 lessons, both Physics teachers retained.
- POST `/validate-context`, `/validate-rules` and `/rule-schema` with the private key: normal JSON responses. These routes are needed by the unchanged Edge Function.
- Repeat generation after an idle period to check startup behavior and response time. Check Vercel logs for import errors, memory failures and invocation timeouts.

After hosted tests succeed, the user manually sets **Supabase → Edge Functions → Secrets → SCHEDULER_URL** to that HTTPS production origin (no endpoint path), and confirms the same **SCHEDULER_API_KEY** there. No SQL change is required. Only then should the app's new generation flow rely on the hosted service. The Edge Function deployment and other secrets still follow `supabase/MANUAL_TIMETABLE_SETUP.md`.

## Validation record

- Existing 48 scheduler tests passed locally, including the 288-lesson representative-school case and HTTP authentication/validation paths.
- User's live local HTTP sample returned `optimal`, 11 lessons and score 100.
- Linux wheel metadata inspected for all pinned production dependencies; size recorded above includes the full wheels without aggressive stripping.
- Vercel build and live HTTPS tests are **pending manual deployment**. Local tests and wheel availability are not a claim that a hosted request has already succeeded.

## Official sources

- [FastAPI entry points and function configuration](https://vercel.com/docs/frameworks/backend/fastapi)
- [Python versions, dependencies and bundling](https://vercel.com/docs/functions/runtimes/python)
- [Function bundle, memory and duration limits](https://vercel.com/docs/functions/limitations)
- [Fluid compute and framework configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Vercel account plans and HTTPS](https://vercel.com/docs/plans)
- [Hobby plan eligibility and quotas](https://vercel.com/docs/plans/hobby)
- [Deployment Protection](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication)
- [OR-Tools 9.15.6755 distributions](https://pypi.org/project/ortools/9.15.6755/#files)
