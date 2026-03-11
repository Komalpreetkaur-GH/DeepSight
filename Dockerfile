# ══════════════════════════════════════════════════════════════
# Specula — Deepfake Forensics Toolkit
# Dockerfile for Hugging Face Spaces
# ══════════════════════════════════════════════════════════════

FROM python:3.11-slim

# Prevent Python from writing .pyc files and buffering stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies for OpenCV headless
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (much smaller than GPU version)
RUN pip install --no-cache-dir \
    torch==2.4.0+cpu \
    torchvision==0.19.0+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Copy and install remaining dependencies (torch excluded, already installed above)
COPY requirements-deploy.txt /app/requirements-deploy.txt
RUN pip install --no-cache-dir -r /app/requirements-deploy.txt

# Copy the full project
COPY . /app

# HF Spaces uses port 7860 by default
EXPOSE 7860

# Start command for Hugging Face Spaces
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
