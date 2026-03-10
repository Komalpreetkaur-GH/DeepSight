# 🔍 DeepSight — Deepfake Forensics Toolkit

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![HuggingFace](https://img.shields.io/badge/HuggingFace-FFD21E?style=for-the-badge&logo=huggingface&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**AI-powered image forensic analysis that detects deepfakes and explains _exactly why_ an image is fake.**

[Live Demo](#) · [How It Works](#-how-it-works) · [Quick Start](#-quick-start) · [Features](#-features)

</div>

---

![DeepSight Landing Page](docs/screenshot-landing.png)

## 🎯 What is DeepSight?

DeepSight is a **full-stack deepfake detection toolkit** that combines **5 independent forensic analysis methods** to determine whether an image is AI-generated or manipulated. Unlike black-box detectors, DeepSight explains its reasoning with **visual heatmaps, spectral analysis, and metadata forensics**.

Built as a modern web app with a FastAPI backend and vanilla JS frontend — no frameworks, no bloat.

## 🔬 How It Works

DeepSight runs **5 parallel forensic analyses** on every uploaded image:

| # | Method | What It Detects | Output |
|---|--------|----------------|--------|
| 🧠 | **CNN Classification** | AI-generated vs. real images using `Ateeqq/ai-vs-human-image-detector` (SigLIP) | Prediction + Grad-CAM heatmap |
| 🔴 | **Error Level Analysis (ELA)** | JPEG compression inconsistencies from splicing/editing | Compression difference heatmap |
| 📊 | **Frequency Analysis** | GAN spectral artifacts in the 2D Fourier domain | FFT spectrum + radial profile chart |
| 🔲 | **Noise Analysis** | Sensor noise consistency using block-wise wavelet decomposition | Noise variance map |
| 📄 | **Metadata Analysis** | AI software signatures in EXIF/PNG metadata (Stable Diffusion, DALL-E, etc.) | Flagged findings |

Results are weighted and combined into a final **verdict score (0–100%)** with a confidence label:

```
PROBABLY REAL → INCONCLUSIVE → SUSPICIOUS → LIKELY AI-GENERATED
```

### Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  HTML + CSS + Vanilla JS (no frameworks)         │
│  ┌─────────────────────────────────────────────┐ │
│  │ Upload → Scan Animation → Results Dashboard │ │
│  │ Batch Grid │ History │ Compare │ PDF Export  │ │
│  └─────────────────────────────────────────────┘ │
├─────────────── FastAPI Backend ──────────────────┤
│  POST /api/analyze         → Single analysis     │
│  POST /api/analyze-batch   → Multi-image batch   │
│  POST /api/report          → PDF report download │
├──────────────── Pipeline Engine ─────────────────┤
│  ForensicPipeline.analyze(image)                 │
│  ├── ELA Analyzer                                │
│  ├── Frequency Analyzer                          │
│  ├── Noise Analyzer                              │
│  ├── Metadata Analyzer                           │
│  └── CNN Classifier (HuggingFace Transformers)   │
│       └── Grad-CAM visualization                 │
└─────────────────────────────────────────────────┘
```

## ✨ Features

### Core Analysis
- **5-method forensic pipeline** with weighted verdict scoring
- **Grad-CAM visualizations** showing which image regions influenced the AI's decision
- Real-time **scanning animation** with progress tracking

### Batch Analysis
- Upload **multiple images** at once (up to 10)
- Results displayed in a **comparison grid** with verdict badges
- Click any card to view detailed analysis

### 📄 PDF Forensic Report
- Generate a **downloadable PDF report** with all analysis results
- Includes verdict summary, per-analyzer scores, and embedded visualizations
- Professional formatting suitable for documentation

### 🔀 Image Comparison
- **Side-by-side comparison** of two analyzed images
- Interactive **score comparison bar chart** (Chart.js)
- Select images from your analysis history

### 🕐 Analysis History
- All analyses **auto-saved to localStorage**
- Browse past results in a **gallery view** with thumbnails
- Persists across browser refreshes
- One-click clear history

### 📱 Fully Responsive
- Optimized for **desktop, tablet, and mobile**
- 5 responsive breakpoints (1200px → 360px)
- Touch-friendly tap targets on mobile devices

![Comparison Mode](docs/screenshot-compare.png)

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- pip

### Installation

```bash
# Clone the repo
git clone https://github.com/Komalpreetkaur-GH/DeepSight.git
cd DeepSight

# Install dependencies
pip install -r backend/requirements.txt

# Run the server
python -m uvicorn backend.main:app --port 8000
```

Open **http://localhost:8000** in your browser.

> **Note:** On first run, the CNN model (~350MB) will be downloaded from HuggingFace. Subsequent runs use the cached model.

### GPU Acceleration (Optional)

If you have an NVIDIA GPU, install PyTorch with CUDA for 3-5x faster analysis:

```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
```

## 📁 Project Structure

```
DeepSight/
├── backend/
│   ├── analyzers/
│   │   ├── classifier.py     # CNN classifier + Grad-CAM
│   │   ├── ela.py            # Error Level Analysis
│   │   ├── frequency.py      # FFT frequency analysis
│   │   ├── noise.py          # Noise variance analysis
│   │   └── metadata.py       # EXIF/metadata scanner
│   ├── main.py               # FastAPI app + API routes
│   ├── pipeline.py           # Orchestrates all analyzers
│   ├── report.py             # PDF report generator
│   └── requirements.txt
├── frontend/
│   ├── index.html            # Single-page app
│   ├── styles.css            # Full design system
│   └── app.js                # All frontend logic
├── docs/                     # Screenshots
└── README.md
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python, FastAPI, Uvicorn |
| **AI/ML** | PyTorch, HuggingFace Transformers, timm |
| **Image Processing** | OpenCV, Pillow, NumPy, SciPy, PyWavelets |
| **PDF Generation** | ReportLab |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **Charts** | Chart.js |
| **Model** | `Ateeqq/ai-vs-human-image-detector` (SigLIP-based) |

## 🧪 API Reference

### `POST /api/analyze`
Upload a single image for forensic analysis.

```bash
curl -X POST http://localhost:8000/api/analyze \
  -F "file=@photo.jpg"
```

### `POST /api/analyze-batch`
Upload multiple images (max 10).

```bash
curl -X POST http://localhost:8000/api/analyze-batch \
  -F "files=@img1.jpg" -F "files=@img2.jpg"
```

### `POST /api/report`
Upload an image and get a PDF forensic report.

```bash
curl -X POST http://localhost:8000/api/report \
  -F "file=@photo.jpg" -o report.pdf
```

## 📊 How Scoring Works

Each analyzer returns a score from 0.0 (definitely real) to 1.0 (definitely fake). These are weighted and combined:

| Analyzer | Weight |
|----------|--------|
| CNN Classifier | 35% |
| ELA | 20% |
| Frequency | 15% |
| Noise | 15% |
| Metadata | 15% |

The weighted average determines the final verdict:
- **< 30%** → Probably Real
- **30–50%** → Inconclusive
- **50–70%** → Suspicious
- **> 70%** → Likely AI-Generated

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built for truth in the age of AI.**

Made with 🧠 by [Komalpreetkaur-GH](https://github.com/Komalpreetkaur-GH)

</div>
