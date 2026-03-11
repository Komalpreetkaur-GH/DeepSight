# ══════════════════════════════════════════════════════════════
# Specula — Deepfake Forensics Toolkit
# Dockerfile for Hugging Face Spaces (Robust PyTorch Build)
# ══════════════════════════════════════════════════════════════

FROM python:3.11

# Set environment
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# 1. Update pip and install PyTorch CPU first (Critical)
RUN pip install --upgrade pip
RUN pip install torch==2.1.2+cpu torchvision==0.16.2+cpu --index-url https://download.pytorch.org/whl/cpu

# 2. Install everything else AFTER torch is in place
COPY requirements-deploy.txt /app/requirements-deploy.txt
# Remove torch entries from requirements to prevent re-install
RUN sed -i '/torch/d' /app/requirements-deploy.txt
RUN pip install -r /app/requirements-deploy.txt

# Copy the full project
COPY . /app

# HF Spaces uses port 7860
EXPOSE 7860

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "7860"]
