import os
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    API_HOST: str = Field(default=os.getenv("API_HOST", "0.0.0.0"))
    API_PORT: int = Field(default=int(os.getenv("API_PORT", "8000")))

    REDIS_HOST: str = Field(default=os.getenv("REDIS_HOST", "localhost"))
    REDIS_PORT: int = Field(default=int(os.getenv("REDIS_PORT", "6379")))

    CELERY_BROKER_URL: str = Field(default=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"))
    CELERY_RESULT_BACKEND: str = Field(default=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"))

    # Provider API keys
    GOOGLE_API_KEY: Optional[str] = Field(default=os.getenv("GOOGLE_API_KEY", None))
    OPENAI_API_KEY: Optional[str] = Field(default=os.getenv("OPENAI_API_KEY", None))
    REPLICATE_API_TOKEN: Optional[str] = Field(default=os.getenv("REPLICATE_API_TOKEN", None))
    RUNPOD_API_KEY: Optional[str] = Field(default=os.getenv("RUNPOD_API_KEY", None))
    RUNPOD_TRELLIS_ENDPOINT_ID: Optional[str] = Field(default=os.getenv("RUNPOD_TRELLIS_ENDPOINT_ID", None))

    # Cloudflare R2 — used to host base64 GLB returned by the TRELLIS.2 worker.
    R2_ENDPOINT_URL: Optional[str] = Field(default=os.getenv("R2_ENDPOINT_URL", None))
    R2_BUCKET: Optional[str] = Field(default=os.getenv("R2_BUCKET", None))
    R2_ACCESS_KEY_ID: Optional[str] = Field(default=os.getenv("R2_ACCESS_KEY_ID", None))
    R2_SECRET_ACCESS_KEY: Optional[str] = Field(default=os.getenv("R2_SECRET_ACCESS_KEY", None))
    R2_PUBLIC_BASE_URL: Optional[str] = Field(default=os.getenv("R2_PUBLIC_BASE_URL", None))
    R2_URL_TTL: int = Field(default=int(os.getenv("R2_URL_TTL", "86400")))

    # Model overrides (verify exact IDs against each provider's current docs)
    GEMINI_CODE_MODEL: str = Field(default=os.getenv("GEMINI_CODE_MODEL", "gemini-2.5-pro"))
    GEMINI_PARSE_MODEL: str = Field(default=os.getenv("GEMINI_PARSE_MODEL", "gemini-2.5-flash-lite"))
    OPENAI_PARSE_MODEL: str = Field(default=os.getenv("OPENAI_PARSE_MODEL", "gpt-5.4-nano"))
    FLUX_MODEL: str = Field(default=os.getenv("FLUX_MODEL", "google/nano-banana"))

    class Config:
        env_file = ".env"

settings = Settings()
