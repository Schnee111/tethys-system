FROM python:3.12-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY pyproject.toml .
COPY backend/ backend/
RUN pip install --no-cache-dir -e .

# Copy frontend build (serve static from FastAPI)
COPY frontend/dist/ static/

EXPOSE 8000

CMD ["uvicorn", "backend.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
