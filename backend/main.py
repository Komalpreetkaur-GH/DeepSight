"""
DeepSight — Deepfake Forensics Toolkit
========================================
FastAPI backend serving the forensic analysis pipeline
and the web frontend.
"""

import io
import json
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from PIL import Image
from pathlib import Path

from .pipeline import ForensicPipeline


def sanitize_for_json(obj):
    """Recursively ensure all values are JSON-serializable."""
    if obj is None or isinstance(obj, (bool,)):
        return obj
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (float, np.floating)):
        return float(obj)
    if isinstance(obj, str):
        return obj
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(item) for item in obj]
    # Fallback: convert anything else to string
    try:
        return str(obj)[:500]
    except Exception:
        return "<unserializable>"

# ── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="DeepSight — Deepfake Forensics Toolkit",
    description="AI-powered image forensics that detects and explains deepfakes",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global Pipeline Instance ─────────────────────────────────────────────────

pipeline = ForensicPipeline()

# ── Static Files ─────────────────────────────────────────────────────────────

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

# ── API Routes ───────────────────────────────────────────────────────────────


@app.get("/")
async def root():
    """Serve the frontend."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return {"message": "DeepSight API is running. Frontend not found at expected path."}


@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "DeepSight Forensics Toolkit"}


@app.post("/api/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Upload an image and run the full forensic analysis pipeline.

    Accepts: JPEG, PNG, WebP, BMP, TIFF
    Returns: Full analysis results with visualizations
    """
    # Validate file type
    allowed_types = {
        "image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff",
    }
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Accepted: JPEG, PNG, WebP, BMP, TIFF",
        )

    # Read and validate image
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image.load()  # Force load to catch corrupt images
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read image file: {str(e)}",
        )

    # Limit image size to prevent OOM
    MAX_DIM = 2048
    if max(image.size) > MAX_DIM:
        ratio = MAX_DIM / max(image.size)
        new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
        image = image.resize(new_size, Image.LANCZOS)

    # Run analysis pipeline
    try:
        results = pipeline.analyze(image)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis pipeline error: {str(e)}",
        )

    response_data = sanitize_for_json({
        "filename": file.filename,
        "image_size": {"width": image.size[0], "height": image.size[1]},
        **results,
    })

    return JSONResponse(content=response_data)


# ── Mount Static Files (after API routes) ────────────────────────────────────

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
