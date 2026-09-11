"""Private service: only server-to-server requests with a shared secret."""
import os
import secrets
from copy import deepcopy
from threading import BoundedSemaphore

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from models import GenerateRequest, GenerateResponse, RuleSet
from scheduler import generate

app = FastAPI(title="School timetable scheduler", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
bearer = HTTPBearer(auto_error=False)
generation_slot = BoundedSemaphore(1)
MAX_BODY_BYTES = 1_000_000


def require_service_key(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    expected = os.environ.get("SCHEDULER_API_KEY", "")
    if len(expected) < 32:
        raise HTTPException(503, "Scheduler access has not been configured.")
    if credentials is None or not secrets.compare_digest(credentials.credentials.encode(), expected.encode()):
        raise HTTPException(401, "Scheduler authentication required.")


@app.middleware("http")
async def bounded_body(request: Request, call_next):
    # Check the actual streamed byte count too: Content-Length is untrusted.
    if request.method == "POST":
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > MAX_BODY_BYTES:
                return JSONResponse({"detail": "The timetable request is too large."}, status_code=413)
        request._body = bytes(body)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def invalid_request(_request: Request, exc: RequestValidationError):
    # Do not echo the prompt, personal data, request values or Python objects.
    return JSONResponse(status_code=422, content={
        "detail": "Please check the timetable configuration or AI conditions.",
        "diagnostics": [{"field": ".".join(str(p) for p in e["loc"]), "message": e["msg"]}
                        for e in exc.errors()[:15]],
    })


@app.post("/health")
def health():
    return {"status": "ok", "schema_version": 1, "engine": "ortools-cp-sat"}


@app.post("/validate-context", dependencies=[Depends(require_service_key)])
def validate_context(request: GenerateRequest):
    if request.rules != RuleSet():
        raise HTTPException(422, "Send configuration without old AI rules when interpreting new instructions.")
    return request


@app.post("/validate-rules", dependencies=[Depends(require_service_key)])
def validate_rules(request: GenerateRequest):
    return {"status": "valid", "rules": request.rules}


def rule_schema():
    schema = deepcopy(RuleSet.model_json_schema())

    def strict(node):
        if isinstance(node, dict):
            node.pop("default", None)
            if node.get("type") == "object":
                node["required"] = list(node["properties"])
                node["additionalProperties"] = False
            for value in node.values():
                strict(value)
        elif isinstance(node, list):
            for value in node:
                strict(value)

    strict(schema)
    return schema


@app.post("/rule-schema", dependencies=[Depends(require_service_key)])
def schema_endpoint():
    return rule_schema()


@app.post("/generate", response_model=GenerateResponse, dependencies=[Depends(require_service_key)])
def generate_endpoint(request: GenerateRequest):
    if not generation_slot.acquire(blocking=False):
        raise HTTPException(429, "A timetable is already being generated. Please try again shortly.")
    try:
        return generate(request)
    finally:
        generation_slot.release()
