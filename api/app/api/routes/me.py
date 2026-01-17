from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth.deps import get_current_user
from app.db.models.user import User

router = APIRouter()


class MeOut(BaseModel):
    id: int
    email: str
    roles: list[str]


@router.get("", response_model=MeOut)
def me(user: User = Depends(get_current_user)):
    return MeOut(id=user.id, email=user.email, roles=[r.name for r in user.roles])
