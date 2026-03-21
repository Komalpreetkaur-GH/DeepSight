# Software Requirements Specification (SRS) — Specula

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to specify the software requirements for **Specula**, an AI-powered deepfake forensics toolkit. Specula is designed to detect and explain image manipulations and synthetic AI-generated content through a multi-method forensic pipeline.

### 1.2 Scope
Specula is a full-stack web application that allows users to upload images for forensic analysis. It provides immediate verdicts supported by visual evidence (heatmaps, spectral charts) and detailed reports.
- **In-Scope**: Single/batch image analysis, URL-based analysis, forensic PDF reports, analysis history, side-by-side comparison.
- **Out-of-Scope**: Video forensic analysis, real-time webcam analysis, user authentication/cloud storage (currently uses local storage).

### 1.3 Definitions, Acronyms, and Abbreviations
- **CNN**: Convolutional Neural Network (used for AI detection).
- **ELA**: Error Level Analysis (detects JPEG compression inconsistencies).
- **FFT**: Fast Fourier Transform (used for spectral frequency analysis).
- **Grad-CAM**: Gradient-weighted Class Activation Mapping (visualizes CNN decision areas).
- **SigLIP**: A vision-language model architecture used by the classifier.

---

## 2. Overall Description

### 2.1 Product Perspective
Specula serves as a specialized toolkit for forensic analysts, researchers, and curious users to verify image authenticity. It operates as a standalone web application with a FastAPI backend and a vanilla JavaScript frontend.

### 2.2 Product Functions
- **Multi-Method Analysis**: Simultaneously run ELA, Frequency, Noise, Metadata, and CNN classification.
- **Weighted Verdict Engine**: Aggregate results into a human-readable verdict (e.g., "Likely AI-Generated").
- **Batch Processing**: Analyze up to 10 images in a single session.
- **Report Generation**: Export forensic findings into a formatted PDF.
- **Local History**: Save past results locally within the browser.
- **Comparison Engine**: Compare two analysis results side-by-side with interactive charts.

### 2.3 User Classes and Characteristics
- **General Users**: Individuals verifying images for personal use (requires intuitive UI).
- **Forensic Analysts**: Professionals requiring technical evidence and downloadable reports.
- **Developers**: Users looking to extend the pipeline or integrate the API.

### 2.4 Operating Environment
- **Backend**: Python 3.10+ on Windows/Linux/macOS.
- **Browser**: Modern web browsers (Chrome, Firefox, Safari, Edge) with JavaScript enabled.
- **Hardware**: Optional NVIDIA GPU for faster CNN inference via CUDA.

### 2.5 Design and Implementation Constraints
- **Framework-less Frontend**: Uses vanilla JS/CSS/HTML for maximum portability and performance.
- **Local Persistence**: No backend database; uses `localStorage` for history.
- **Model Dependencies**: Relies on specific HuggingFace models (SigLIP).

---

## 3. External Interface Requirements

### 3.1 User Interfaces
- **Responsive Dashboard**: Optimized for desktop and mobile (360px to 1200px+).
- **Scanning HUD**: Interactive animation showing pipeline progress.
- **Visual Evidence Panels**: Interactive 3D heatmaps and Chart.js spectral graphs.

### 3.2 Hardware Interfaces
- **Storage**: Minimum 1GB free space for model caching.
- **RAM**: Minimum 4GB RAM recommended for image processing.

### 3.3 Software Interfaces
- **FastAPI**: RESTful API for communication between UI and Forensic Pipeline.
- **ReportLab**: Interface for generating PDF documents.
- **HuggingFace Transformers**: Interface for loading and running ML models.

---

## 4. System Features (Functional Requirements)

### 4.1 Forensic Analysis Pipeline
- **FR 1.1**: The system shall run five (5) forensic analyses: CNN, ELA, Frequency, Noise, and Metadata.
- **FR 1.2**: The system shall generate a heatmap (Grad-CAM) for CNN results.
- **FR 1.3**: The system shall generate a compression difference heatmap for ELA.
- **FR 1.4**: The system shall provide a 2D FFT spectrum and radial power chart.
- **FR 1.5**: The system shall compute a unified verdict score (0–100%) and label.

### 4.2 Image Upload & Processing
- **FR 2.1**: The system shall support JPEG, PNG, WebP, BMP, and TIFF formats.
- **FR 2.2**: The system shall automatically resize images exceeding 2048px to prevent memory issues.
- **FR 2.3**: The system shall support image analysis via URL fetch.

### 4.3 Batch Analysis
- **FR 3.1**: Users shall be able to upload up to 10 images for concurrent batch analysis.
- **FR 3.2**: Results shall be displayed in a summary grid.

### 4.4 Reporting and History
- **FR 4.1**: The system shall allow users to download a PDF Forensic Report for any analyzed image.
- **FR 4.2**: The system shall store the last 20 analyses in browser local storage.
- **FR 4.3**: Users shall be able to compare two items from history side-by-side.

---

## 5. Non-functional Requirements

### 5.1 Performance
- **NR 1.1**: Single image analysis should complete within 3–10 seconds (depending on hardware).
- **NR 1.2**: The UI must remain responsive during batch backend processing.

### 5.2 Security
- **NR 2.1**: The system shall sanitize all filenames and metadata before display.
- **NR 2.2**: The system shall limit file sizes (e.g., 20MB) to prevent Denial of Service.

### 5.3 Usability
- **NR 3.1**: The system shall provide clear, non-technical summaries for each forensic method.
- **NR 3.2**: Dark mode and light mode must be supported via theme toggle.
