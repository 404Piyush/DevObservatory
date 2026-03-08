from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    environment: str = "local"
    api_prefix: str = "/api"

    postgres_dsn: str = Field(
        default="postgresql+psycopg://devobservatory:devobservatory@localhost:5432/devobservatory",
        validation_alias=AliasChoices("POSTGRES_DSN", "DATABASE_URL", "postgres_dsn"),
    )
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://devobservatory:devobservatory@localhost:5672/"

    jwt_issuer: str = "devobservatory"
    jwt_audience: str = "devobservatory"
    jwt_secret_key: str = "change-me"
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30

    cors_allowed_origins: list[str] = Field(
        default=["http://localhost:3000"],
        validation_alias=AliasChoices("CORS_ALLOWED_ORIGINS", "CORS_ALLOW_ORIGINS", "cors_allowed_origins"),
    )

    s3_endpoint_url: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key_id: str = "devobservatory"
    s3_secret_access_key: str = "devobservatory"
    s3_bucket: str = "devobservatory"

    @field_validator("postgres_dsn", mode="before")
    @classmethod
    def _normalize_postgres_dsn(cls, v: object) -> str:
        if v is None:
            return v
        dsn = str(v).strip()
        if dsn.startswith("postgres://"):
            dsn = "postgresql://" + dsn[len("postgres://") :]

        if dsn.startswith("postgresql://") and not dsn.startswith("postgresql+"):
            dsn = "postgresql+psycopg://" + dsn[len("postgresql://") :]

        parsed = urlparse(dsn)
        host = (parsed.hostname or "").lower()
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if host.endswith(".neon.tech") and "sslmode" not in query:
            query["sslmode"] = "require"
            dsn = urlunparse(parsed._replace(query=urlencode(query)))

        return dsn

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def _parse_cors_allowed_origins(cls, v: object) -> list[str]:
        if v is None:
            return v
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        s = str(v).strip()
        if not s:
            return []
        if s.startswith("["):
            import json

            parsed = json.loads(s)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        return [part.strip() for part in s.split(",") if part.strip()]


settings = Settings()
