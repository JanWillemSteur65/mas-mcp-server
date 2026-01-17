from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import auth, me, tenants, users, roles, messages, concepts, logs, settings

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["auth"])
router.include_router(me.router, prefix="/me", tags=["me"])
router.include_router(users.router, prefix="/users", tags=["users"])
router.include_router(roles.router, prefix="/roles", tags=["roles"])
router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
router.include_router(messages.router, prefix="/messages", tags=["messages"])
router.include_router(concepts.router, prefix="/concepts", tags=["concepts"])
router.include_router(logs.router, prefix="/logs", tags=["logs"])
router.include_router(settings.router, prefix="/settings", tags=["settings"])
