from __future__ import annotations

import contextlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.routing import Mount

from app.config import settings
from app.observability.logging import configure_logging
from app.observability.otel import configure_otel
from app.api.router import router as api_router
from app.db.init_db import init_db

def _origin_ok(origin: str | None) -> bool:
    if not origin:
        return True
    allow = [o.strip() for o in settings.cors_allow_origins.split(",") if o.strip()]
    if not allow or allow == ["*"]:
        return True
    return origin in allow

from app.mcp.server import mcp, mcp_lifespan


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # MCP session manager must run in lifespan when mounted.
    async with mcp_lifespan():
        yield


def create_app() -> FastAPI:
    configure_logging(settings.env)

    app = FastAPI(title="MAS MCP Server", lifespan=lifespan)

    @app.middleware("http")
    async def mcp_origin_guard(request, call_next):
        if request.url.path.startswith("/mcp"):
            origin = request.headers.get("origin")
            if not _origin_ok(origin):
                from fastapi import Response
                return Response(status_code=403, content="Forbidden")
        return await call_next(request)


    # CORS (configure properly in production)
    allow = [o.strip() for o in settings.cors_allow_origins.split(",")] if settings.cors_allow_origins else []
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"]
        ,
        expose_headers=["Mcp-Session-Id"],
    )

    # REST API
    app.include_router(api_router, prefix=settings.api_base_path)

    # MCP mounted at /mcp (Streamable HTTP).
    app.mount("/mcp", mcp.streamable_http_app(json_response=True, streamable_http_path="/"))

    configure_otel(app, settings.otel_service_name, settings.otel_exporter_otlp_endpoint)

    return app


app = create_app()
