from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )

    # API
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Fitness Tracker"

    # CORS
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://localhost:3174", "http://127.0.0.1:5173", "http://127.0.0.1:3000", "http://127.0.0.1:3174"]

    # Database
    DATABASE_URL: str = "sqlite:///./fitness_tracker.db"

    # Security
    SECRET_KEY: str = "change-this-in-production-random-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30


settings = Settings()
