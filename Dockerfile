# ══════════════════════════════════════════════════════════════
# Specula — Deepfake Forensics Toolkit
# Dockerfile for Hugging Face Spaces (Compatible Build)
# ══════════════════════════════════════════════════════════════

FROM python:3.10-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system dependencies for OpenCV, PyTorch, and general build
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU directly (more stable for HF builds)
RUN pip install --no-cache-dir \
    torch==2.1.2 torchvision==0.16.2 \
    --index-url https://download.pytorch.org/whl/cpu

# Copy and install the rest of the dependencies
COPY requirements-deploy.txt /app/requirements-deploy.txt
RUN pip install --no-cache-dir -r /app/requirements-deploy.txt

# Copy project files
COPY . /app

# HF Spaces uses port 7860
EXPOSE 7860

# Start Specula
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
