"""
Specula — Deepfake Forensics Toolkit
FastAPI Backend
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
    title="Specula — Deepfake Forensics Toolkit",
    description="Backend API for image and batch forensic analysis. that detects and explains deepfakes",
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
    return {"message": "Specula API is running. Frontend not found at expected path."}


@app.get("/api")
async def api_root():
    return {"message": "Specula API is running. Frontend not found at expected path."}


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Specula Forensics Toolkit"}


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


@app.post("/api/analyze-batch")
async def analyze_batch(files: list[UploadFile] = File(...)):
    """
    Upload multiple images and run forensic analysis on each.
    Returns an array of results. Max 10 images per batch.
    """
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 images per batch.")

    all_results = []
    for file in files:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents))
            image.load()

            # Resize if too large
            MAX_DIM = 2048
            if max(image.size) > MAX_DIM:
                ratio = MAX_DIM / max(image.size)
                new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
                image = image.resize(new_size, Image.LANCZOS)

            results = pipeline.analyze(image)

            all_results.append(sanitize_for_json({
                "filename": file.filename,
                "image_size": {"width": image.size[0], "height": image.size[1]},
                **results,
            }))
        except Exception as e:
            all_results.append({
                "filename": file.filename,
                "error": str(e),
                "verdict": {"label": "ERROR", "score": 0, "color": "#ef4444", "summary": str(e)},
            })

    return JSONResponse(content=all_results)


@app.post("/api/report")
async def generate_report_endpoint(file: UploadFile = File(...)):
    """
    Upload an image, analyze it, and return a PDF forensic report.
    """
    from .report import generate_report
    from fastapi.responses import StreamingResponse

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image.load()

        MAX_DIM = 2048
        if max(image.size) > MAX_DIM:
            ratio = MAX_DIM / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        results = pipeline.analyze(image)

        analysis_data = sanitize_for_json({
            "filename": file.filename,
            "image_size": {"width": image.size[0], "height": image.size[1]},
            **results,
        })

        pdf_bytes = generate_report(analysis_data)

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Specula_Report_{file.filename}.pdf"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")


@app.post("/api/analyze-url")
async def analyze_url(body: dict):
    """
    Fetch an image from a URL and run forensic analysis.
    Expects JSON body: {"url": "https://..."}
    """
    import requests as http_requests
    from urllib.parse import urlparse

    url = body.get("url", "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="No URL provided.")

    # Basic URL validation
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    try:
        # Fetch image
        resp = http_requests.get(url, timeout=15, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }, stream=True)
        resp.raise_for_status()

        # Check content type
        content_type = resp.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail=f"URL does not point to an image (got {content_type})")

        # Read image
        image_data = resp.content
        if len(image_data) > 20 * 1024 * 1024:  # 20MB limit
            raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

        image = Image.open(io.BytesIO(image_data))
        image.load()

        # Resize if too large
        MAX_DIM = 2048
        if max(image.size) > MAX_DIM:
            ratio = MAX_DIM / max(image.size)
            new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        # Extract filename from URL
        filename = parsed.path.split("/")[-1] or "url_image"
        if not any(filename.lower().endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp")):
            filename += ".jpg"

        results = pipeline.analyze(image)

        response_data = sanitize_for_json({
            "filename": filename,
            "source_url": url,
            "image_size": {"width": image.size[0], "height": image.size[1]},
            **results,
        })

        return JSONResponse(content=response_data)

    except HTTPException:
        raise
    except http_requests.exceptions.Timeout:
        raise HTTPException(status_code=408, detail="Timeout: Could not fetch image within 15 seconds")
    except http_requests.exceptions.RequestException as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch image: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── Mount Static Files (after API routes) ────────────────────────────────────

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

