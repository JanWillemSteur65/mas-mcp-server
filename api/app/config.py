from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration.

    All settings can be overridden with environment variables prefixed by MAS_MCP_.
    Example: MAS_MCP_DATABASE_URL=postgresql+psycopg2://...
    """

    model_config = SettingsConfigDict(env_prefix="MAS_MCP_", env_file=".env", extra="ignore")

    # App
    env: str = "dev"
    api_base_path: str = "/api"
    cors_allow_origins: str = "*"  # comma-separated in prod

    # Database
    database_url: str = "postgresql+psycopg2://masmcp:masmcp@postgres:5432/masmcp"

    # Security
    jwt_secret: str = "CHANGE_ME"
    jwt_issuer: str = "mas-mcp-server"
    jwt_audience: str = "mas-mcp-ui"
    jwt_exp_minutes: int = 60

    # Maximo
    maximo_request_timeout_seconds: int = 30

    # Observability
    otel_service_name: str = "mas-mcp-server"
    otel_exporter_otlp_endpoint: str = ""  # e.g. http://otel-collector:4318


settings = Settings()
