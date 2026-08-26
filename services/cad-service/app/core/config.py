from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    port: int = 8001
    internal_api_key: str
    redis_url: str = "redis://localhost:6379"
    aws_region: str = "us-east-1"
    s3_bucket_name: str
    # V2.1A diagnostic-only. Off by default so the parity endpoint is not
    # registered (or listed in openapi.json) in production deployments.
    # Set ENABLE_PARITY_ENDPOINT=1 locally or in CI to enable.
    enable_parity_endpoint: bool = False

    class Config:
        env_file = ".env"


settings = Settings()  # type: ignore[call-arg]
