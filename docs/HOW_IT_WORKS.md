# Specula — How It Works (Step by Step)

A plain-English walkthrough of what happens from the moment you upload an image to the moment the verdict appears on screen.

---

## Step 1 — You Upload the Image

You visit the Specula web page in your browser. You either drag and drop an image onto the upload box, or click it to open a file picker and choose an image from your computer.

The moment you select the image, your browser reads the file from your local disk using the **JavaScript `FileReader` API** — the image never leaves your computer at this point. It reads it purely in memory.

It then immediately creates a live preview using **HTML `<input type="file">`** and **JavaScript DOM manipulation** — you see a thumbnail of your image appear right on screen, along with the filename and file size, without the page refreshing.

> **At this stage, nothing is sent to the server yet. The image is only sitting in your browser's memory.**

---

## Step 2 — You Click "Analyze"

You click the Analyze button. The browser switches to a scanning screen with an animated progress bar and rotating status messages like *"Running Error Level Analysis…"* and *"Running neural network…"* — these are powered by **JavaScript `setInterval`** and **CSS animations**, and are purely visual feedback while the browser waits for the server.

Behind the scenes, the browser takes your image (still in memory from Step 1), wraps it into a **`FormData` packet** using the **JavaScript `FormData` API**, and fires it off to the backend server as an HTTP POST request to `/api/analyze` using the **JavaScript `fetch` API**.

The `fetch` call uses **`async/await`** so the browser stays fully responsive and doesn't freeze while waiting.

> **This is the moment your image leaves the browser and travels to the server for the first time.**

---

## Step 3 — The Server Receives & Prepares the Image

The backend is a **Python** program powered by **FastAPI** — a web framework running on a **Uvicorn** server — that is always listening for incoming requests. The moment your image arrives via HTTP POST, FastAPI routes it to the `/api/analyze` handler.

The server then performs three checks:

**Check 1 — Valid image type?**
FastAPI inspects the file's content type. If it's anything other than JPEG, PNG, WebP, BMP, or TIFF, it immediately rejects it and sends an error back to the browser.

**Check 2 — Is it readable?**
The server hands the raw file bytes to **Pillow** (Python's most popular image library), which tries to fully open and load the image into memory. If the file is corrupted or broken, Pillow throws an error and the server rejects it.

**Check 3 — Is it too big?**
Pillow checks the pixel dimensions. If either side is larger than 2048 pixels, Pillow automatically shrinks it using the **Lanczos** high-quality resizing algorithm, while keeping the proportions intact. This stops the AI models from running out of memory on huge images.

> **At the end of this step, the server has a clean, validated, properly-sized image in memory as a Pillow Image object — ready to be passed into the analysis pipeline.**

---

## Step 4 — Analyzer 1: Error Level Analysis (ELA)

### What It Finds
ELA is a classic photo forensics technique. It looks for inconsistencies in compression quality across different parts of the image. If an image is a normal untouched photograph, every part of it should have been compressed the same number of times. If someone edited it — or if an AI generated it — those regions will show a different compression signature than the rest.

### How Specula Does It
**Pillow** takes your image and re-saves it at a deliberately low JPEG quality (around 90%) into memory using **Python's `io.BytesIO`** — nothing is written to disk. It then loads the re-saved version back and hands both images to **NumPy**, which subtracts them pixel by pixel. What remains is the difference — amplified so it's visible to the eye. This difference map is the ELA heatmap.

- **Same degradation everywhere** → image is consistent → likely real and untouched → dark, flat heatmap
- **One region degrades very differently from the rest** → something is off → likely edited, pasted, or AI-generated → bright spikes in that region

The **average brightness** of the heatmap (measured by NumPy) becomes the ELA score between 0 and 1.

### What You See in Specula
The ELA panel shows a **3D spike visualization** rendered by **Three.js** in the browser. Each spike's height represents how much that pixel region reacted to re-compression. Tall orange/red spikes = suspicious regions. A flat dark surface = consistent, normal image.

---

## Step 5 — Analyzer 2: Frequency Analysis

### What It Finds
Every image is mathematically made up of waves of different frequencies — fine details are high frequency, smooth areas are low frequency. Real photographs have a natural, organic spread of these waves. AI-generated images, synthesized by neural networks, leave behind unnatural frequency patterns — like a hidden fingerprint.

### How Specula Does It
Specula's `frequency.py` applies a mathematical operation called **FFT (Fast Fourier Transform)** using **NumPy**. FFT breaks the image down from pixels into its underlying wave frequencies — like splitting white light into a rainbow with a prism.

This produces the **frequency spectrum** visible in Specula's results panel. In a real photo, energy spreads naturally and tapers off smoothly from the center. In an AI image, there are often sharp spikes, grid-like artifacts, or unnatural bright rings in the spectrum.

NumPy then computes a **radial profile** — measuring energy at each distance from the center outward — which becomes the line chart rendered in the browser by **Chart.js**.

- **Steep smooth dropoff on the chart** → energy concentrated in low frequencies → natural → real photo
- **Bumps, secondary peaks, or unusual energy at mid-to-high frequencies** → AI fingerprint → suspicious

---

## Step 6 — Analyzer 3: Noise Analysis

### What It Finds
Every real photograph has natural, random noise — tiny random variations in pixel brightness caused by the camera sensor. This noise is organic and irregular, varying across different parts of the image. AI-generated images are synthesized mathematically, so their noise is either too uniform, too perfect, or completely missing.

### How Specula Does It
Specula's `noise.py` uses **OpenCV** (a powerful Python image processing library) to extract the noise. It applies a blur filter to the image, then subtracts the blurred version from the original — what's left behind is the noise. **NumPy** then analyses this noise map, measuring how uniform or varied the noise is across the image.

- **Organic, unevenly scattered variation** → natural sensor noise → real photo
- **Completely flat with no noise at all** → too clean → AI image (no sensor)
- **Perfectly uniform or grid-patterned noise** → structured mathematical noise → AI image

### What You See in Specula
The Noise panel shows a **3D green surface visualization** rendered by **Three.js**. Hills represent noisy regions. Natural organic rippling = real photo. Perfectly flat or perfectly grid-like = suspicious.

---

## Step 7 — Analyzer 4: Metadata Analysis

### What It Finds
Every image file carries invisible data called **EXIF/IPTC metadata** — information like what camera model was used, lens settings, date/time, GPS location, and editing software. Real photographs always have rich camera metadata. AI-generated images either have no metadata at all, or metadata that directly names the AI tool that created them.

### How Specula Does It
Specula's `metadata.py` uses **Pillow** to extract all hidden metadata fields from your image. It scans for red flags:

- **No camera make, model, or lens info** → suspicious. Real cameras always leave this.
- **AI tool names** → keywords like `"Stable Diffusion"`, `"Midjourney"`, `"DALL-E"`, `"ComfyUI"` in the Software or Creator fields → immediate red flag.
- **Missing timestamps or GPS** → not suspicious alone, but adds to the overall score when combined with other missing fields.

The more missing or suspicious fields, the higher the metadata score.

> **Metadata is the fastest analyzer — but also the easiest to cheat. Someone could strip all metadata with one click. That's why Specula has 4 other analyzers.**

---

## Step 8 — Analyzer 5: CNN Classifier (The Most Powerful)

### What It Finds
Unlike the previous 4 analyzers which use mathematical/forensic techniques, the CNN uses **actual AI to detect AI**. It is a deep neural network trained on thousands of real and AI-generated images, and has learned to recognize the subtle visual patterns that AI generators leave behind — patterns often invisible to the human eye.

### The Model
Specula loads a pre-trained model called **`Ateeqq/ai-vs-human-image-detector`** from **HuggingFace** — an open-source AI model hub. It is based on a **Vision Transformer (ViT)** architecture, specifically trained to classify images as either `"artificial"` or `"real"`. The model is lazy-loaded — it only downloads and loads into memory on the very first analysis, then stays loaded for all subsequent ones.

### How Specula Runs It
Your image is passed through **HuggingFace's `pipeline`** (a high-level wrapper built on **PyTorch** that handles all preprocessing automatically). The model outputs two confidence scores — one for `"artificial"` and one for `"real"` — that always add up to 100%. Specula reads whichever label came out and converts it to a score between 0 (real) and 1 (AI-generated).

### The Grad-CAM Heatmap
After classification, Specula generates a **Grad-CAM heatmap** using **PyTorch**. This answers: *"which specific regions of the image made the CNN say AI?"*

PyTorch hooks into the last convolutional layer of the model, runs a backward pass, and computes which pixels had the most influence on the decision. **OpenCV** then converts that into a colour heatmap overlaid on your original image — red/warm regions = high influence on the decision, blue/cool = low influence.

This heatmap is rendered as an interactive **3D surface by Three.js** in Specula's CNN panel.

> **The CNN carries 35–75% of the final verdict weight depending on how confident it is — more than all the other 4 analyzers combined.**

---

## Step 9 — The Final Verdict: Combining All 5 Scores

After all 5 analyzers finish, Specula's `pipeline.py` combines their individual scores into one final score using a smart weighted system.

### How the Weighting Works

Specula first measures how confident the CNN is — how far its score is from 0.5. The further away, the more certain it is.

| CNN Confidence | CNN Weight | Traditional Analyzers Weight |
|---|---|---|
| Highly confident (>85% or <15%) | 60% | 40% |
| Extremely confident (>95% or <5%) | 75% | 25% |
| Uncertain (close to 50%) | 40% | 60% |

### Verdict Labels

| Final Score | Verdict |
|---|---|
| Below 0.25 | ✅ LIKELY REAL |
| 0.25 – 0.40 | 🟢 PROBABLY REAL |
| 0.40 – 0.55 | 🟡 INCONCLUSIVE |
| 0.55 – 0.70 | 🟠 SUSPICIOUS |
| 0.70 – 0.85 | 🔴 LIKELY AI-GENERATED |
| Above 0.85 | 🔴 AI-GENERATED |

The verdict banner, animated gauge, and plain-English summary are all determined by where the final score lands on this scale.

---

## Step 10 — Results Travel Back & Get Displayed

### On the Server
The Python backend packages everything into a single **JSON response** — the verdict, all 5 analyzer results, heatmap images encoded as **base64 text**, total analysis time, and image dimensions. This JSON is sent back over HTTP to the browser.

### In the Browser
The `fetch` call from Step 2 finally receives its reply. The scanning animation stops and Specula's JavaScript `renderResults()` function takes over:

- The page switches from the scanning screen to the results screen
- The **verdict gauge** draws itself using the **Canvas API**, with the score counting up from 0 using `requestAnimationFrame`
- After an 800ms delay for visual effect, all 5 analyzer panels populate — descriptions, score badges, and heatmaps
- The **ELA and CNN Grad-CAM heatmaps** render as interactive 3D surfaces using **Three.js**
- The **frequency spectrum chart** draws using **Chart.js**
- The result is saved to **`localStorage`** in your browser, powering Specula's History feature

---

## Full Journey Summary

| Step | What Happens | Where |
|---|---|---|
| 1 | You pick an image, browser shows preview | Browser (FileReader API) |
| 2 | You click Analyze, image is sent to server | Browser → Server (fetch + FormData) |
| 3 | Server validates and resizes the image | Server (FastAPI + Pillow) |
| 4 | ELA analyzer checks compression inconsistencies | Server (Pillow + NumPy) |
| 5 | Frequency analyzer checks wave patterns | Server (NumPy FFT) |
| 6 | Noise analyzer checks sensor noise patterns | Server (OpenCV + NumPy) |
| 7 | Metadata analyzer scans EXIF for AI signatures | Server (Pillow) |
| 8 | CNN classifier runs deep learning detection | Server (PyTorch + HuggingFace) |
| 9 | All scores combined into final verdict | Server (pipeline.py) |
| 10 | Results sent back and displayed | Server → Browser (Canvas + Three.js + Chart.js) |
