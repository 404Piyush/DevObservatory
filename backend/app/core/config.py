from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    environment: str = "local"
    api_prefix: str = "/api"

    postgres_dsn: str = "postgresql+psycopg://devobservatory:devobservatory@localhost:5432/devobservatory"
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://devobservatory:devobservatory@localhost:5672/"

    jwt_issuer: str = "devobservatory"
    jwt_audience: str = "devobservatory"
    jwt_secret_key: str = "change-me"
    access_token_ttl_seconds: int = 900
    refresh_token_ttl_seconds: int = 60 * 60 * 24 * 30

    cors_allow_origins: list[str] = ["http://localhost:3000"]

    s3_endpoint_url: str = "http://localhost:9000"
    s3_region: str = "us-east-1"
    s3_access_key_id: str = "devobservatory"
    s3_secret_access_key: str = "devobservatory"
    s3_bucket: str = "devobservatory"


settings = Settings()
