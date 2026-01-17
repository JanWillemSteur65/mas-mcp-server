from __future__ import annotations

import os

from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.db.base import Base
from app.db.session import engine, SessionLocal

# Import models so they register with SQLAlchemy
from app.db.models import user, role, user_role, tenant, tenant_discovery, concept, message, trace_log, setting  # noqa
from app.db.models.user import User
from app.db.models.role import Role


def init_schema() -> None:
    Base.metadata.create_all(bind=engine)


def bootstrap() -> None:
    """Create default roles + an initial admin user if none exist.

    Controlled by env:
      - MAS_MCP_BOOTSTRAP_ADMIN_EMAIL (default: admin@example.com)
      - MAS_MCP_BOOTSTRAP_ADMIN_PASSWORD (default: admin)

    Change these in production.
    """

    admin_email = os.environ.get("MAS_MCP_BOOTSTRAP_ADMIN_EMAIL", "admin@example.com").strip().lower()
    admin_password = os.environ.get("MAS_MCP_BOOTSTRAP_ADMIN_PASSWORD", "admin")

    db: Session = SessionLocal()
    try:
        # roles
        for r in ["admin", "tenant-admin", "operator", "viewer"]:
            if not db.query(Role).filter(Role.name == r).first():
                db.add(Role(name=r))
        db.commit()

        # admin user
        if not db.query(User).first():
            u = User(email=admin_email, password_hash=hash_password(admin_password), is_active=True)
            admin_role = db.query(Role).filter(Role.name == "admin").first()
            if admin_role:
                u.roles.append(admin_role)
            db.add(u)
            db.commit()
    finally:
        db.close()


def init_db() -> None:
    init_schema()
    bootstrap()


if __name__ == "__main__":
    init_db()
