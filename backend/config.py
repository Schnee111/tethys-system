"""Tethys — Configuration.

Loads from .env file. No insecure defaults — fails loudly if DATABASE_URL is missing.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from project root
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(_env_path)

# Database — REQUIRED
DATABASE_URL: str = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Example: postgresql://tethys:***@localhost:5433/tethys"
    )

# API Server
API_HOST: str = os.getenv("API_HOST", "127.0.0.1")
API_PORT: int = int(os.getenv("API_PORT", "8000"))

# Environment
TETHYS_ENV: str = os.getenv("TETHYS_ENV", "development")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# Collector intervals (seconds)
SEISMIC_POLL_INTERVAL = 60
SOLAR_WIND_POLL_INTERVAL = 300
GOES_POLL_INTERVAL = 60
DONKI_POLL_INTERVAL = 900
ATMOSPHERIC_POLL_INTERVAL = 21600  # 6 hours
VOLCANIC_POLL_INTERVAL = 3600  # 1 hour
