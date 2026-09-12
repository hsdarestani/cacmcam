from __future__ import annotations

import asyncio
import base64
import json
import os
import uuid
from datetime import timedelta, timezone
from typing import Any

import httpx
from fastapi import Depends
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

import pet_app as base
import pet_management

app = base.app


class PushDevice(base.Base):
    __tablename__ = 'pet_push_devices'
    __table_args__ = (UniqueConstraint('token', name='uq_pet_push_token'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    token: Mapped[str] = mapped_column(Text)
    platform: Mapped[str] = mapped_column(String(16), default='android')
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    events_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), default=base.utcnow)
    updated_at: Mapped[Any] = mapped_column(DateTime(timezone=True), default=base.utcnow)


class PushDelivery(base.Base):
    __tablename__ = 'pet_push_deliveries'
    __table_args__ = (UniqueConstraint('push_device_id', 'event_key', name='uq_pet_push_delivery'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    push_device_id: Mapped[str] = mapped_column(String(36), index=True)
    event_key: Mapped[str] = mapped_column(String(180), index=True)
    status: Mapped[str] = mapped_column(String(20), default='pending')
    error: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[Any] = mapped_column(DateTime(timezone=True), default=base.utcnow)


class RegisterBody(BaseModel):
    token: str = Field(min_length=20, max_length=4096)
    platform: str = Field(default='android', pattern='^(android|ios)$')


class PreferencesBody(BaseModel):
    enabled: bool = True
    reminders_enabled: bool = True
    events_enabled: bool = True


def device_dict(row: PushDevice) -> dict[str, Any]:
    return {'registered': True, 'platform': row.platform, 'enabled': row.enabled,
            'reminders_enabled': row.reminders_enabled, 'events_enabled': row.events_enabled}


@app.post('/api/pet/push/register')
def register_push(body: RegisterBody, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    row = db.scalar(select(PushDevice).where(PushDevice.token == body.token))
    if not row:
        row = PushDevice(user_id=user.id, token=body.token, platform=body.platform)
        db.add(row)
    else:
        row.user_id = user.id
        row.platform = body.platform
        row.enabled = True
        row.updated_at = base.utcnow()
    db.commit(); db.refresh(row)
    return device_dict(row)


@app.get('/api/pet/push/preferences')
def push_preferences(user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    rows = db.scalars(select(PushDevice).where(PushDevice.user_id == user.id)).all()
    if not rows:
        return {'registered': False, 'enabled': True, 'reminders_enabled': True, 'events_enabled': True}
    row = max(rows, key=lambda value: value.updated_at or value.created_at)
    return device_dict(row)


@app.put('/api/pet/push/preferences')
def update_push_preferences(body: PreferencesBody, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    rows = db.scalars(select(PushDevice).where(PushDevice.user_id == user.id)).all()
    for row in rows:
        row.enabled = body.enabled; row.reminders_enabled = body.reminders_enabled
        row.events_enabled = body.events_enabled; row.updated_at = base.utcnow()
    db.commit()
    return body.model_dump() | {'registered': bool(rows)}


@app.post('/api/pet/push/test')
async def test_push(user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    rows = db.scalars(select(PushDevice).where(PushDevice.user_id == user.id, PushDevice.enabled.is_(True))).all()
    if not rows:
        return {'ok': False, 'message': 'این گوشی هنوز برای اعلان ثبت نشده است'}
    results = [await send_fcm(row.token, 'CamCam آماده است 🐾', 'اعلان‌های نیتیو با موفقیت فعال شدند.',
                              {'route': 'home', 'kind': 'test'}) for row in rows]
    return {'ok': any(ok for ok, _ in results), 'sent': sum(1 for ok, _ in results if ok)}


def firebase_credentials():
    raw = os.getenv('FIREBASE_SERVICE_ACCOUNT_B64', '').strip()
    if not raw:
        return None
    try:
        info = json.loads(base64.b64decode(raw).decode('utf-8'))
        return service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/firebase.messaging'])
    except Exception as exc:
        print('invalid Firebase service account:', exc)
        return None


async def send_fcm(token: str, title: str, body: str, data: dict[str, str]) -> tuple[bool, str]:
    credentials = firebase_credentials()
    if not credentials:
        return False, 'firebase_not_configured'
    try:
        await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())
        project_id = credentials.project_id
        payload = {'message': {'token': token, 'notification': {'title': title, 'body': body},
            'data': {key: str(value) for key, value in data.items()},
            'android': {'priority': 'high', 'notification': {'channel_id': 'camcam_reminders', 'sound': 'default'}}}}
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(f'https://fcm.googleapis.com/v1/projects/{project_id}/messages:send',
                headers={'Authorization': f'Bearer {credentials.token}'}, json=payload)
        if response.is_success:
            return True, ''
        return False, response.text[:500]
    except Exception as exc:
        return False, str(exc)[:500]


def recipient_ids(db: Session, device_id: str) -> set[str]:
    device = db.get(base.Device, device_id)
    if not device:
        return set()
    ids = {device.owner_id}
    ids.update(db.scalars(select(base.PetCameraShare.user_id).where(base.PetCameraShare.device_id == device_id)).all())
    return ids


async def process_due_reminders() -> None:
    before = max(0, int(os.getenv('PUSH_REMINDER_MINUTES_BEFORE', '15')))
    now = base.utcnow(); window_end = now + timedelta(minutes=before + 1)
    with base.SessionLocal() as db:
        items = db.scalars(select(pet_management.PetCareItem).where(
            pet_management.PetCareItem.archived.is_(False),
            pet_management.PetCareItem.completed_at.is_(None),
            pet_management.PetCareItem.due_at.is_not(None),
            pet_management.PetCareItem.due_at <= window_end,
            pet_management.PetCareItem.due_at >= now - timedelta(hours=12),
        )).all()
        jobs = []
        for item in items:
            setting = base.get_setting(db, item.device_id)
            pet_name = setting.pet_name or 'پت'
            due = item.due_at
            if due and due.tzinfo is None: due = due.replace(tzinfo=timezone.utc)
            event_key = f'reminder:{item.id}:{due.isoformat() if due else "none"}'
            for uid in recipient_ids(db, item.device_id):
                devices = db.scalars(select(PushDevice).where(PushDevice.user_id == uid,
                    PushDevice.enabled.is_(True), PushDevice.reminders_enabled.is_(True))).all()
                for target in devices:
                    exists = db.scalar(select(PushDelivery).where(PushDelivery.push_device_id == target.id,
                        PushDelivery.event_key == event_key))
                    if exists: continue
                    delivery = PushDelivery(push_device_id=target.id, event_key=event_key)
                    db.add(delivery); db.commit(); db.refresh(delivery)
                    jobs.append((delivery.id, target.token, f'یادآور {pet_name}', item.title,
                        {'route': 'medical', 'device_id': item.device_id, 'item_id': item.id, 'kind': 'reminder'}))
        for delivery_id, token, title, message, data in jobs:
            ok, error = await send_fcm(token, title, message, data)
            delivery = db.get(PushDelivery, delivery_id)
            if delivery:
                delivery.status = 'sent' if ok else 'failed'; delivery.error = error; db.commit()


async def process_camera_events() -> None:
    now = base.utcnow()
    labels = {'motion': 'حرکت تشخیص داده شد', 'sound': 'صدایی شنیده شد',
              'inactivity': 'بی‌تحرکی طولانی تشخیص داده شد'}
    with base.SessionLocal() as db:
        events = db.scalars(select(base.Event).where(base.Event.created_at >= now - timedelta(minutes=10),
            base.Event.kind.in_(tuple(labels))).order_by(base.Event.created_at.asc())).all()
        jobs = []
        for event in events:
            setting = base.get_setting(db, event.device_id); pet_name = setting.pet_name or 'پت'
            event_key = f'camera:{event.id}'
            for uid in recipient_ids(db, event.device_id):
                devices = db.scalars(select(PushDevice).where(PushDevice.user_id == uid,
                    PushDevice.enabled.is_(True), PushDevice.events_enabled.is_(True))).all()
                for target in devices:
                    exists = db.scalar(select(PushDelivery).where(PushDelivery.push_device_id == target.id,
                        PushDelivery.event_key == event_key))
                    if exists: continue
                    delivery = PushDelivery(push_device_id=target.id, event_key=event_key)
                    db.add(delivery); db.commit(); db.refresh(delivery)
                    jobs.append((delivery.id, target.token, f'CamCam · {pet_name}', labels[event.kind],
                        {'route': 'camera', 'device_id': event.device_id, 'event_id': event.id, 'kind': event.kind}))
        for delivery_id, token, title, message, data in jobs:
            ok, error = await send_fcm(token, title, message, data)
            delivery = db.get(PushDelivery, delivery_id)
            if delivery:
                delivery.status = 'sent' if ok else 'failed'; delivery.error = error; db.commit()


async def notification_loop() -> None:
    while True:
        try:
            await process_due_reminders()
            await process_camera_events()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print('pet reminder push loop failed:', exc)
        await asyncio.sleep(60)
