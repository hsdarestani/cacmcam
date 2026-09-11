from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Integer, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

import pet_app as base

app = base.app


class PetProfile(base.Base):
    __tablename__ = 'pet_profiles'

    device_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    breed: Mapped[str] = mapped_column(String(80), default='')
    birth_date: Mapped[str | None] = mapped_column(String(10), nullable=True)
    sex: Mapped[str] = mapped_column(String(12), default='unknown')
    weight_grams: Mapped[int | None] = mapped_column(Integer, nullable=True)
    microchip: Mapped[str] = mapped_column(String(80), default='')
    vet_name: Mapped[str] = mapped_column(String(120), default='')
    vet_phone: Mapped[str] = mapped_column(String(50), default='')
    notes: Mapped[str] = mapped_column(Text, default='')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow)


class CareTask(base.Base):
    __tablename__ = 'pet_care_tasks'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(30), default='custom')
    time_of_day: Mapped[str | None] = mapped_column(String(5), nullable=True)
    days_json: Mapped[str] = mapped_column(Text, default='[0,1,2,3,4,5,6]')
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow)


class CareLog(base.Base):
    __tablename__ = 'pet_care_logs'
    __table_args__ = (
        UniqueConstraint('device_id', 'task_id', 'local_date', name='uq_pet_care_task_day'),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    task_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    kind: Mapped[str] = mapped_column(String(30), default='custom')
    title: Mapped[str] = mapped_column(String(100))
    note: Mapped[str] = mapped_column(Text, default='')
    local_date: Mapped[str] = mapped_column(String(10), index=True)
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow, index=True)


class ProfileBody(BaseModel):
    breed: str = Field(default='', max_length=80)
    birth_date: str | None = Field(default=None, pattern=r'^\d{4}-\d{2}-\d{2}$')
    sex: str = Field(default='unknown', pattern=r'^(male|female|unknown)$')
    weight_kg: float | None = Field(default=None, ge=0.1, le=250)
    microchip: str = Field(default='', max_length=80)
    vet_name: str = Field(default='', max_length=120)
    vet_phone: str = Field(default='', max_length=50)
    notes: str = Field(default='', max_length=2000)


class CareTaskBody(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    kind: str = Field(
        default='custom',
        pattern=r'^(feed|water|walk|medication|grooming|play|custom)$',
    )
    time_of_day: str | None = Field(default=None, pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    enabled: bool = True


class CareDoneBody(BaseModel):
    local_date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    note: str = Field(default='', max_length=500)


class QuickLogBody(BaseModel):
    local_date: str = Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    kind: str = Field(
        default='custom',
        pattern=r'^(feed|water|walk|medication|grooming|play|custom)$',
    )
    title: str = Field(min_length=1, max_length=100)
    note: str = Field(default='', max_length=500)


class CapabilityBody(BaseModel):
    torch_supported: bool | None = None
    zoom_supported: bool | None = None
    camera_switch_supported: bool | None = None
    speech_supported: bool | None = None
    sound_detection_supported: bool | None = None
    talk_supported: bool | None = None
    battery_supported: bool | None = None


_MEM_CAPABILITIES: dict[str, dict[str, Any]] = {}


def profile_row(db: Session, device_id: str) -> PetProfile:
    row = db.get(PetProfile, device_id)
    if row:
        return row
    row = PetProfile(device_id=device_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def profile_dict(row: PetProfile) -> dict[str, Any]:
    return {
        'breed': row.breed or '',
        'birth_date': row.birth_date,
        'sex': row.sex or 'unknown',
        'weight_kg': round(row.weight_grams / 1000, 2) if row.weight_grams else None,
        'microchip': row.microchip or '',
        'vet_name': row.vet_name or '',
        'vet_phone': row.vet_phone or '',
        'notes': row.notes or '',
        'updated_at': row.updated_at,
    }


def normalize_days(values: list[int]) -> list[int]:
    days = sorted({int(v) for v in values if isinstance(v, int) and 0 <= int(v) <= 6})
    if not days:
        raise HTTPException(400, 'حداقل یک روز برای برنامه انتخاب کن')
    return days


def task_dict(row: CareTask) -> dict[str, Any]:
    try:
        days = json.loads(row.days_json or '[]')
    except Exception:
        days = [0, 1, 2, 3, 4, 5, 6]
    return {
        'id': row.id,
        'title': row.title,
        'kind': row.kind,
        'time_of_day': row.time_of_day,
        'days': days,
        'enabled': row.enabled,
        'created_at': row.created_at,
        'updated_at': row.updated_at,
    }


def log_dict(row: CareLog) -> dict[str, Any]:
    return {
        'id': row.id,
        'task_id': row.task_id,
        'kind': row.kind,
        'title': row.title,
        'note': row.note or '',
        'local_date': row.local_date,
        'happened_at': row.happened_at,
        'user_id': row.user_id,
    }


def parse_local_date(value: str) -> datetime:
    try:
        return datetime.strptime(value, '%Y-%m-%d')
    except ValueError as exc:
        raise HTTPException(400, 'تاریخ نامعتبر است') from exc


def capability_key(device_id: str) -> str:
    return f'pet:capabilities:{device_id}'


def store_capabilities(device_id: str, body: CapabilityBody) -> dict[str, Any]:
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    data['updated_at'] = base.utcnow().isoformat()
    if base.redis_client:
        try:
            base.redis_client.setex(capability_key(device_id), 600, json.dumps(data))
            return data
        except Exception:
            pass
    _MEM_CAPABILITIES[device_id] = data
    return data


def load_capabilities(device_id: str) -> dict[str, Any] | None:
    if base.redis_client:
        try:
            raw = base.redis_client.get(capability_key(device_id))
            if raw:
                return json.loads(raw)
        except Exception:
            pass
    return _MEM_CAPABILITIES.get(device_id)


@app.get('/api/pet/devices/{device_id}/profile')
def get_profile(
    device_id: str,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    return profile_dict(profile_row(db, device_id))


@app.put('/api/pet/devices/{device_id}/profile')
def update_profile(
    device_id: str,
    body: ProfileBody,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = profile_row(db, device_id)
    row.breed = body.breed.strip()
    row.birth_date = body.birth_date
    row.sex = body.sex
    row.weight_grams = int(round(body.weight_kg * 1000)) if body.weight_kg else None
    row.microchip = body.microchip.strip()
    row.vet_name = body.vet_name.strip()
    row.vet_phone = body.vet_phone.strip()
    row.notes = body.notes.strip()
    row.updated_at = base.utcnow()
    db.commit()
    db.refresh(row)
    return profile_dict(row)


@app.get('/api/pet/devices/{device_id}/care/tasks')
def list_care_tasks(
    device_id: str,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    rows = db.scalars(
        select(CareTask)
        .where(CareTask.device_id == device_id)
        .order_by(CareTask.time_of_day.asc(), CareTask.created_at.asc())
    ).all()
    return [task_dict(row) for row in rows]


@app.post('/api/pet/devices/{device_id}/care/tasks')
def create_care_task(
    device_id: str,
    body: CareTaskBody,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = CareTask(
        device_id=device_id,
        title=body.title.strip(),
        kind=body.kind,
        time_of_day=body.time_of_day,
        days_json=json.dumps(normalize_days(body.days)),
        enabled=body.enabled,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return task_dict(row)


@app.put('/api/pet/devices/{device_id}/care/tasks/{task_id}')
def update_care_task(
    device_id: str,
    task_id: str,
    body: CareTaskBody,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = db.get(CareTask, task_id)
    if not row or row.device_id != device_id:
        raise HTTPException(404, 'برنامه پیدا نشد')
    row.title = body.title.strip()
    row.kind = body.kind
    row.time_of_day = body.time_of_day
    row.days_json = json.dumps(normalize_days(body.days))
    row.enabled = body.enabled
    row.updated_at = base.utcnow()
    db.commit()
    db.refresh(row)
    return task_dict(row)


@app.delete('/api/pet/devices/{device_id}/care/tasks/{task_id}')
def delete_care_task(
    device_id: str,
    task_id: str,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = db.get(CareTask, task_id)
    if not row or row.device_id != device_id:
        raise HTTPException(404, 'برنامه پیدا نشد')
    db.delete(row)
    db.commit()
    return {'ok': True}


@app.post('/api/pet/devices/{device_id}/care/tasks/{task_id}/done')
def complete_care_task(
    device_id: str,
    task_id: str,
    body: CareDoneBody,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    parse_local_date(body.local_date)
    task = db.get(CareTask, task_id)
    if not task or task.device_id != device_id or not task.enabled:
        raise HTTPException(404, 'برنامه پیدا نشد')
    existing = db.scalar(
        select(CareLog)
        .where(
            CareLog.device_id == device_id,
            CareLog.task_id == task.id,
            CareLog.local_date == body.local_date,
        )
        .order_by(CareLog.happened_at.desc())
        .limit(1)
    )
    if existing:
        return log_dict(existing)
    row = CareLog(
        device_id=device_id,
        task_id=task.id,
        user_id=user.id,
        kind=task.kind,
        title=task.title,
        note=body.note.strip(),
        local_date=body.local_date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return log_dict(row)


@app.post('/api/pet/devices/{device_id}/care/logs')
def create_quick_log(
    device_id: str,
    body: QuickLogBody,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id, caregiver=True)
    parse_local_date(body.local_date)
    row = CareLog(
        device_id=device_id,
        task_id=None,
        user_id=user.id,
        kind=body.kind,
        title=body.title.strip(),
        note=body.note.strip(),
        local_date=body.local_date,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return log_dict(row)


@app.get('/api/pet/devices/{device_id}/care/today')
def care_today(
    device_id: str,
    local_date: str | None = None,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    local_date = local_date or base.utcnow().strftime('%Y-%m-%d')
    parsed = parse_local_date(local_date)
    weekday = parsed.weekday()

    tasks = db.scalars(
        select(CareTask)
        .where(CareTask.device_id == device_id, CareTask.enabled.is_(True))
        .order_by(CareTask.time_of_day.asc(), CareTask.created_at.asc())
    ).all()
    tasks = [task for task in tasks if weekday in task_dict(task)['days']]

    logs = db.scalars(
        select(CareLog)
        .where(CareLog.device_id == device_id, CareLog.local_date == local_date)
        .order_by(CareLog.happened_at.desc())
        .limit(100)
    ).all()
    done_task_ids = {row.task_id for row in logs if row.task_id}
    return {
        'local_date': local_date,
        'profile': profile_dict(profile_row(db, device_id)),
        'tasks': [task_dict(row) for row in tasks],
        'done_task_ids': sorted(done_task_ids),
        'logs': [log_dict(row) for row in logs],
        'completed': len(done_task_ids),
        'total': len(tasks),
    }


@app.post('/api/pet/device/capabilities')
def publish_capabilities(
    body: CapabilityBody,
    x_device_id: str | None = Header(default=None),
    x_device_token: str | None = Header(default=None),
    db: Session = Depends(base.get_db),
):
    device = base.verify_device(db, x_device_id, x_device_token)
    return store_capabilities(device.id, body)


@app.get('/api/pet/devices/{device_id}/capabilities')
def get_capabilities(
    device_id: str,
    user: base.User = Depends(base.current_user),
    db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    return load_capabilities(device_id) or {}
