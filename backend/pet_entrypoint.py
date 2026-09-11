from __future__ import annotations

import json
from typing import Any

from fastapi import Depends, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import pet_app as base

app = base.app

# Registers persistent pet profile, care routine, care log and device capability routes
# before FastAPI lifespan starts, so SQLAlchemy creates the related tables safely.
import pet_care  # noqa: E402,F401


class CommandAckBody(BaseModel):
    command_id: str = Field(min_length=1, max_length=160)
    type: str = Field(default='', max_length=40)
    value: Any = None
    ok: bool
    message: str = Field(default='', max_length=500)
    applied_at: str | None = Field(default=None, max_length=80)
    extra: dict[str, Any] = Field(default_factory=dict)


_MEM_ACKS: dict[str, dict[str, Any]] = {}


def ack_key(device_id: str, command_id: str) -> str:
    return f'pet:commandack:{device_id}:{command_id}'


def store_ack(device_id: str, command_id: str, payload: dict[str, Any]) -> None:
    key = ack_key(device_id, command_id)
    if base.redis_client:
        try:
            base.redis_client.setex(key, 180, json.dumps(payload, ensure_ascii=False))
            return
        except Exception:
            pass
    _MEM_ACKS[key] = payload


def load_ack(device_id: str, command_id: str) -> dict[str, Any] | None:
    key = ack_key(device_id, command_id)
    if base.redis_client:
        try:
            raw = base.redis_client.get(key)
            return json.loads(raw) if raw else None
        except Exception:
            pass
    return _MEM_ACKS.get(key)


@app.post('/api/pet/device/command-ack')
def device_command_ack(
    body: CommandAckBody,
    x_device_id: str | None = Header(default=None),
    x_device_token: str | None = Header(default=None),
    db: Session = Depends(base.get_db),
):
    device = base.verify_device(db, x_device_id, x_device_token)
    payload = {
        'command_id': body.command_id,
        'type': body.type,
        'value': body.value,
        'ok': body.ok,
        'message': body.message,
        'applied_at': body.applied_at or base.utcnow().isoformat(),
        **body.extra,
    }
    store_ack(device.id, body.command_id, payload)
    device.last_seen_at = base.utcnow()
    db.commit()
    return {'ok': True}


@app.get('/api/pet/devices/{device_id}/commands/{command_id}/status')
def command_status(
    device_id: str,
    command_id: str,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    ack = load_ack(device_id, command_id)
    if not ack:
        return {'status': 'pending', 'ack': None}
    return {'status': 'applied' if ack.get('ok') else 'failed', 'ack': ack}
