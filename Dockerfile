# ══════════════════════════════════════════════════════════════
# Specula — Deepfake Forensics Toolkit
# Dockerfile for Hugging Face Spaces
# ══════════════════════════════════════════════════════════════

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# System dependencies for OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for layer caching)
COPY requirements-deploy.txt /app/requirements-deploy.txt

# Install all Python packages together so pip can resolve conflicts
# torch CPU is specified directly in requirements-deploy.txt via --extra-index-url
RUN pip install \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r /app/requirements-deploy.txt

# Copy the full project
COPY . /app

# HF Spaces uses port 7860
EXPOSE 7860

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
