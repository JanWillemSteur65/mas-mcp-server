from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.security import hash_password
from app.db.session import get_db
from app.db.models.user import User

router = APIRouter()


class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    is_active: bool


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    return [UserOut(id=u.id, email=u.email, is_active=u.is_active) for u in db.query(User).order_by(User.id.asc()).all()]


@router.post("", response_model=UserOut)
def create_user(body: UserCreate, db: Session = Depends(get_db), _=Depends(require_roles("admin"))):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = User(email=body.email, password_hash=hash_password(body.password), is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut(id=user.id, email=user.email, is_active=user.is_active)
