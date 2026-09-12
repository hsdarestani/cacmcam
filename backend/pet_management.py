from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, DateTime, Integer, String, Text, select
from sqlalchemy.orm import Mapped, Session, mapped_column

import pet_app as base
import pet_care

app = base.app


class PetCareItem(base.Base):
    __tablename__ = 'pet_management_items'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id: Mapped[str] = mapped_column(String(36), index=True)
    created_by: Mapped[str] = mapped_column(String(36), index=True)
    category: Mapped[str] = mapped_column(String(24), index=True)
    title: Mapped[str] = mapped_column(String(140))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    repeat_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    provider: Mapped[str] = mapped_column(String(140), default='')
    dosage: Mapped[str] = mapped_column(String(120), default='')
    notes: Mapped[str] = mapped_column(Text, default='')
    metadata_json: Mapped[str] = mapped_column(Text, default='{}')
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=base.utcnow)


class CareItemBody(BaseModel):
    category: str = Field(pattern='^(vaccination|medication|appointment|grooming|nutrition|document|reminder)$')
    title: str = Field(min_length=1, max_length=140)
    due_at: datetime | None = None
    repeat_days: int | None = Field(default=None, ge=1, le=3650)
    provider: str = Field(default='', max_length=140)
    dosage: str = Field(default='', max_length=120)
    notes: str = Field(default='', max_length=4000)
    metadata: dict[str, Any] = Field(default_factory=dict)


def item_dict(row: PetCareItem) -> dict[str, Any]:
    try:
        metadata = json.loads(row.metadata_json or '{}')
    except Exception:
        metadata = {}
    return {
        'id': row.id, 'category': row.category, 'title': row.title, 'due_at': row.due_at,
        'completed_at': row.completed_at, 'repeat_days': row.repeat_days,
        'provider': row.provider or '', 'dosage': row.dosage or '', 'notes': row.notes or '',
        'metadata': metadata, 'archived': row.archived, 'created_at': row.created_at,
        'updated_at': row.updated_at,
    }


def editable_item(db: Session, user: base.User, device_id: str, item_id: str) -> PetCareItem:
    base.authorized_device(db, user, device_id, caregiver=True)
    row = db.scalar(select(PetCareItem).where(PetCareItem.id == item_id, PetCareItem.device_id == device_id))
    if not row:
        raise HTTPException(404, 'مورد مراقبتی پیدا نشد')
    return row


@app.get('/api/pet/devices/{device_id}/management/items')
def list_items(
    device_id: str, category: str | None = Query(default=None), include_completed: bool = True,
    user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db),
):
    base.authorized_device(db, user, device_id)
    query = select(PetCareItem).where(PetCareItem.device_id == device_id, PetCareItem.archived.is_(False))
    if category:
        query = query.where(PetCareItem.category == category)
    if not include_completed:
        query = query.where(PetCareItem.completed_at.is_(None))
    rows = db.scalars(query.order_by(PetCareItem.due_at.asc(), PetCareItem.created_at.desc())).all()
    return [item_dict(row) for row in rows]


@app.post('/api/pet/devices/{device_id}/management/items')
def create_item(device_id: str, body: CareItemBody, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    base.authorized_device(db, user, device_id, caregiver=True)
    row = PetCareItem(device_id=device_id, created_by=user.id, metadata_json=json.dumps(body.metadata, ensure_ascii=False), **body.model_dump(exclude={'metadata'}))
    db.add(row); db.commit(); db.refresh(row)
    return item_dict(row)


@app.put('/api/pet/devices/{device_id}/management/items/{item_id}')
def update_item(device_id: str, item_id: str, body: CareItemBody, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    row = editable_item(db, user, device_id, item_id)
    for key, value in body.model_dump(exclude={'metadata'}).items():
        setattr(row, key, value)
    row.metadata_json = json.dumps(body.metadata, ensure_ascii=False); row.updated_at = base.utcnow()
    db.commit(); return item_dict(row)


@app.post('/api/pet/devices/{device_id}/management/items/{item_id}/complete')
def complete_item(device_id: str, item_id: str, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    row = editable_item(db, user, device_id, item_id)
    row.completed_at = base.utcnow()
    next_item = None
    if row.repeat_days and row.due_at:
        next_item = PetCareItem(device_id=device_id, created_by=user.id, category=row.category, title=row.title,
                                due_at=row.due_at + timedelta(days=row.repeat_days), repeat_days=row.repeat_days,
                                provider=row.provider, dosage=row.dosage, notes=row.notes, metadata_json=row.metadata_json)
        db.add(next_item)
    db.commit()
    return {'item': item_dict(row), 'next_item': item_dict(next_item) if next_item else None}


@app.delete('/api/pet/devices/{device_id}/management/items/{item_id}')
def archive_item(device_id: str, item_id: str, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    row = editable_item(db, user, device_id, item_id); row.archived = True; row.updated_at = base.utcnow(); db.commit()
    return {'ok': True}


@app.get('/api/pet/devices/{device_id}/management/dashboard')
def management_dashboard(device_id: str, user: base.User = Depends(base.current_user), db: Session = Depends(base.get_db)):
    device, role = base.authorized_device(db, user, device_id)
    now = base.utcnow(); horizon = now + timedelta(days=30)
    pending = db.scalars(select(PetCareItem).where(
        PetCareItem.device_id == device_id, PetCareItem.archived.is_(False), PetCareItem.completed_at.is_(None),
    ).order_by(PetCareItem.due_at.asc()).limit(50)).all()
    health = db.scalars(select(pet_care.HealthLog).where(pet_care.HealthLog.device_id == device_id)
                        .order_by(pet_care.HealthLog.happened_at.desc()).limit(8)).all()
    overdue, upcoming = [], []
    for row in pending:
        value = row.due_at
        if value and value.tzinfo is None: value = value.replace(tzinfo=timezone.utc)
        if value and value < now: overdue.append(row)
        elif value and value <= horizon: upcoming.append(row)
    setting = base.get_setting(db, device_id)
    profile = db.get(pet_care.PetProfile, device_id); detail = db.get(pet_care.PetProfileDetail, device_id)
    return {
        'pet': {'name': setting.pet_name or device.name, 'type': setting.pet_type,
                'profile': pet_care.profile_dict(profile, detail) if profile else {}},
        'access': role, 'online': bool(device.last_seen_at and device.last_seen_at.replace(tzinfo=device.last_seen_at.tzinfo or timezone.utc) > now - timedelta(seconds=45)),
        'overdue': [item_dict(x) for x in overdue], 'upcoming': [item_dict(x) for x in upcoming],
        'recent_health': [pet_care.health_log_dict(x) for x in health],
        'counts': {'pending': len(pending), 'overdue': len(overdue),
                   'medications': sum(1 for x in pending if x.category == 'medication'),
                   'vaccinations': sum(1 for x in pending if x.category == 'vaccination')},
    }
