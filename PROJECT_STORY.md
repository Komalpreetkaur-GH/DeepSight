# The Specula Story: Development & Rationale

This document tracks how we built Specula, the technical choices we made, and the "why" behind every component. We focused on building a tool that doesn't just give a verdict, but provides **transparent forensic evidence.**

## 1. The Core Philosophy: "Explainable Forensics"
Most deepfake detectors are "black boxes"—they say "AI" or "Human" without explaining why. We chose a **Multi-Method Pipeline** approach. 
- **Why?** To provide redundancy. If the CNN model is uncertain, traditional forensics (ELA, Noise) can provide the missing clues.

## 2. Technical Decisions (The "How" and "Why")

### Backend: FastAPI & Python
- **Choice**: FastAPI.
- **Why?** It's extremely fast, provides automatic OpenAPI documentation, and handles asynchronous file uploads (critical for batch analysis) efficiently. Python is the native language for the AI ecosystem (PyTorch, OpenCV).

### Frontend: Vanilla JS, CSS, and HTML
- **Choice**: No frameworks (React/Vue/Tailwind).
- **Why?** To eliminate "bloat" and maintain absolute control over the DOM. This was essential for implementing the custom **3D Heatmap visualizations** and the **dynamic scan animations** without fighting a virtual DOM.

### The Forensic Pipeline
We implemented 5 specific modules because they target different "fingerprints":
1. **CNN (SigLIP)**: Targets semantic AI patterns (e.g., weird hair, eyes).
2. **ELA (Error Level Analysis)**: Targets "splicing" (e.g., a face pasted onto a body).
3. **Frequency (FFT)**: Targets "spectral artifacts" inherent to how GANs and Diffusion models generate pixels.
4. **Noise**: Targets "sensor consistency," ensuring the image wasn't stitched from multiple sources.
5. **Metadata**: Targets "software signatures" left by AI generators.

## 3. Key Feature Rationale

### Batch Analysis
- **Why?** Forensic analysts rarely look at one image. They often have a set of images from a single source. Batch processing allows them to spot patterns across a collection.

### Offline-First History (`localStorage`)
- **Why?** We avoided a database to keep the app "portable" and private. Your data stays in your browser.

### PDF Forensic Reports
- **Why?** To make the results "official." A screenshot is easy to forge; a formatted PDF with embedded visualizations is suitable for professional documentation.

### Weighted Verdict Engine
- **Why?** Not all analyzers are equal. We gave the **CNN 35% weight** because it's the most modern signal, while **Metadata has 10%** because it's the easiest to spoof. The engine uses a "CNN-dominant" logic to ensure a high-confidence AI detection isn't "watered down" by a clean metadata scan.

## 4. Design Aesthetics
- **Choice**: Sharp corners, deep blues, grid backgrounds.
- **Why?** We moved away from "soft/glass" designs to a "high-tech forensic" aesthetic. This creates a sense of precision and authority, matching the toolkit's purpose.
