"""Server-to-server client for the recruitment platform.

The agent runs server-side, so it can safely hold AGENT_SHARED_SECRET and call
the platform's /api/agent/* endpoints to fetch JD context and report results.
Uses urllib so it adds no extra dependency.
"""
import asyncio
import json
import os
import urllib.error
import urllib.request


def _platform_url() -> str:
    return os.getenv("PLATFORM_URL", "http://localhost:3002").rstrip("/")


def _secret() -> str:
    return os.getenv("AGENT_SHARED_SECRET", "")


def application_id_from_room(room_name: str | None) -> str | None:
    """Rooms created by the platform are named `assessment_<id>` / `interview_<id>` / `buddy_<id>`."""
    if not room_name:
        return None
    for prefix in ("assessment_", "interview_", "buddy_"):
        if room_name.startswith(prefix):
            return room_name[len(prefix):]
    return None


def _get_context_sync(application_id: str) -> dict | None:
    url = f"{_platform_url()}/api/agent/context?applicationId={application_id}"
    req = urllib.request.Request(url, headers={"x-agent-secret": _secret()})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, ValueError) as e:
        print(f"[platform] context fetch failed: {e}")
        return None


def _post_result_sync(payload: dict) -> bool:
    url = f"{_platform_url()}/api/agent/result"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-agent-secret": _secret()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status < 300
    except urllib.error.URLError as e:
        print(f"[platform] result post failed: {e}")
        return False


async def fetch_context(application_id: str) -> dict | None:
    return await asyncio.to_thread(_get_context_sync, application_id)


async def post_result(payload: dict) -> bool:
    return await asyncio.to_thread(_post_result_sync, payload)


# ---- Career Buddy (learning module) ----
def _get_learning_context_sync(employee_id: str) -> dict | None:
    url = f"{_platform_url()}/api/agent/learning-context?employeeId={employee_id}"
    req = urllib.request.Request(url, headers={"x-agent-secret": _secret()})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except (urllib.error.URLError, ValueError) as e:
        print(f"[platform] learning context fetch failed: {e}")
        return None


def _post_learning_result_sync(payload: dict) -> bool:
    url = f"{_platform_url()}/api/agent/learning-result"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "x-agent-secret": _secret()},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status < 300
    except urllib.error.URLError as e:
        print(f"[platform] learning result post failed: {e}")
        return False


async def fetch_learning_context(employee_id: str) -> dict | None:
    return await asyncio.to_thread(_get_learning_context_sync, employee_id)


async def post_learning_result(payload: dict) -> bool:
    return await asyncio.to_thread(_post_learning_result_sync, payload)
