from __future__ import annotations

import base64
import hashlib
import hmac
import re
from dataclasses import dataclass
from os import environ

from fastapi import Cookie, Header, Response

from skillhub.domain.errors import InvariantError

ACTOR_HEADER = "X-SkillHub-Actor"
ACTOR_COOKIE = "skillhub_actor"
DEFAULT_LOCAL_ACTOR = "product-operator"
ACTOR_PATTERN = re.compile(r"^[A-Za-z0-9._@-]{1,120}$")


@dataclass(frozen=True)
class ActorContext:
    id: str
    subject_type: str = "user"


def normalize_actor(actor: str) -> str:
    actor = actor.strip()
    if not actor:
        raise InvariantError("Actor identity cannot be blank.")
    if not ACTOR_PATTERN.fullmatch(actor):
        raise InvariantError("Actor identity may only contain letters, numbers, '.', '_', '@', or '-'.")
    return actor


def sign_actor_session(actor: str) -> str:
    actor_part = _base64_url_encode(normalize_actor(actor).encode("utf-8"))
    signature = hmac.new(_session_secret(), actor_part.encode("ascii"), hashlib.sha256).digest()
    return f"{actor_part}.{_base64_url_encode(signature)}"


def verify_actor_session(session_value: str) -> str:
    try:
        actor_part, signature_part = session_value.split(".", 1)
        expected = hmac.new(_session_secret(), actor_part.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(signature_part, _base64_url_encode(expected)):
            raise ValueError
        return normalize_actor(_base64_url_decode(actor_part).decode("utf-8"))
    except Exception as exc:
        raise InvariantError("Invalid actor session.") from exc


def set_actor_cookie(response: Response, actor: str) -> None:
    response.set_cookie(
        key=ACTOR_COOKIE,
        value=sign_actor_session(actor),
        httponly=True,
        secure=environ.get("SKILLHUB_SESSION_COOKIE_SECURE") == "1",
        samesite="lax",
        max_age=60 * 60 * 24 * 30,
        path="/",
    )


def clear_actor_cookie(response: Response) -> None:
    response.delete_cookie(key=ACTOR_COOKIE, path="/")


def actor_dependency(
    skillhub_actor: str | None = Cookie(default=None, alias=ACTOR_COOKIE),
    x_skillhub_actor: str | None = Header(default=None, alias=ACTOR_HEADER),
) -> ActorContext:
    if skillhub_actor is not None:
        return ActorContext(id=verify_actor_session(skillhub_actor))
    return ActorContext(id=normalize_actor(x_skillhub_actor or DEFAULT_LOCAL_ACTOR))


def _session_secret() -> bytes:
    return environ.get("SKILLHUB_SESSION_SECRET", "skillhub-local-dev-secret").encode("utf-8")


def _base64_url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _base64_url_decode(value: str) -> bytes:
    padded = value + ("=" * (-len(value) % 4))
    return base64.urlsafe_b64decode(padded.encode("ascii"))
