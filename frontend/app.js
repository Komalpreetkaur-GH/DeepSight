/**
 * DeepSight — Deepfake Forensics Toolkit
 * Frontend Application Logic
 * ================================================
 * Handles file upload, API communication, results rendering,
 * and interactive visualizations.
 */

// ── DOM References ──────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    // Sections
    hero: $("#hero-section"),
    scanning: $("#scanning-section"),
    results: $("#results-section"),

    // Upload
    uploadZone: $("#upload-zone"),
    fileInput: $("#file-input"),
    filePreview: $("#file-preview"),
    previewImage: $("#preview-image"),
    fileName: $("#file-name"),
    fileSize: $("#file-size"),
    analyzeBtn: $("#analyze-btn"),
    resetBtn: $("#reset-btn"),

    // Scanning
    scanImage: $("#scan-image"),
    scanStatusText: $("#scan-status-text"),
    scanProgressBar: $("#scan-progress-bar"),

    // Verdict
    verdictBanner: $("#verdict-banner"),
    verdictGauge: $("#verdict-gauge"),
    verdictScore: $("#verdict-score"),
    verdictLabel: $("#verdict-label"),
    verdictSummary: $("#verdict-summary"),
    analysisTime: $("#analysis-time"),
    imageDims: $("#image-dims"),

    // Panels
    cnnPrediction: $("#cnn-prediction"),
    cnnDescription: $("#cnn-description"),
    cnnGradcam: $("#cnn-gradcam"),
    cnnScoreBadge: $("#cnn-score-badge"),

    elaDescription: $("#ela-description"),
    elaHeatmap: $("#ela-heatmap"),
    elaScoreBadge: $("#ela-score-badge"),

    freqDescription: $("#freq-description"),
    freqSpectrum: $("#freq-spectrum"),
    freqChart: $("#freq-chart"),
    freqScoreBadge: $("#freq-score-badge"),

    noiseDescription: $("#noise-description"),
    noiseMap: $("#noise-map"),
    noiseScoreBadge: $("#noise-score-badge"),

    metaDescription: $("#meta-description"),
    metaFlags: $("#meta-flags"),
    metaDetails: $("#meta-details"),
    metaScoreBadge: $("#meta-score-badge"),

    // Actions
    newAnalysisBtn: $("#new-analysis-btn"),
};

// ── State ───────────────────────────────────────────────────────

let selectedFile = null;
let freqChartInstance = null;

// ── File Upload Handling ────────────────────────────────────────

dom.uploadZone.addEventListener("click", () => dom.fileInput.click());
dom.fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));

// Drag and drop
dom.uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.uploadZone.classList.add("drag-over");
});

dom.uploadZone.addEventListener("dragleave", () => {
    dom.uploadZone.classList.remove("drag-over");
});

dom.uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.uploadZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
        handleFileSelect(file);
    }
});

function handleFileSelect(file) {
    if (!file) return;
    selectedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        dom.previewImage.src = e.target.result;
        dom.scanImage.src = e.target.result;
    };
    reader.readAsDataURL(file);

    dom.fileName.textContent = file.name;
    dom.fileSize.textContent = formatSize(file.size);

    dom.uploadZone.classList.add("hidden");
    dom.filePreview.classList.remove("hidden");
}

dom.resetBtn.addEventListener("click", resetToUpload);
dom.analyzeBtn.addEventListener("click", startAnalysis);
dom.newAnalysisBtn.addEventListener("click", resetToUpload);

function resetToUpload() {
    selectedFile = null;
    dom.fileInput.value = "";

    dom.hero.classList.remove("hidden");
    dom.scanning.classList.add("hidden");
    dom.results.classList.add("hidden");

    dom.uploadZone.classList.remove("hidden");
    dom.filePreview.classList.add("hidden");

    // Clean up chart
    if (freqChartInstance) {
        freqChartInstance.destroy();
        freqChartInstance = null;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── Analysis ────────────────────────────────────────────────────

async function startAnalysis() {
    if (!selectedFile) return;

    // Show scanning UI
    dom.hero.classList.add("hidden");
    dom.scanning.classList.remove("hidden");
    dom.results.classList.add("hidden");

    // Animate progress bar
    const scanMessages = [
        "Initializing forensic analysis...",
        "Running Error Level Analysis...",
        "Analyzing frequency spectrum...",
        "Examining noise patterns...",
        "Scanning metadata for AI signatures...",
        "Running neural network classification...",
        "Generating Grad-CAM explanations...",
        "Aggregating results...",
    ];

    let msgIndex = 0;
    const messageInterval = setInterval(() => {
        msgIndex = (msgIndex + 1) % scanMessages.length;
        dom.scanStatusText.textContent = scanMessages[msgIndex];
    }, 2500);

    // Animate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 8, 90);
        dom.scanProgressBar.style.width = `${progress}%`;
    }, 500);

    try {
        // Call API
        const formData = new FormData();
        formData.append("file", selectedFile);

        const response = await fetch("/api/analyze", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Analysis failed");
        }

        const data = await response.json();

        // Complete progress
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        dom.scanProgressBar.style.width = "100%";
        dom.scanStatusText.textContent = "Analysis complete!";

        // Brief pause to show completion
        await sleep(600);

        // Show results
        renderResults(data);
    } catch (error) {
        clearInterval(progressInterval);
        clearInterval(messageInterval);

        dom.scanStatusText.textContent = `Error: ${error.message}`;
        dom.scanProgressBar.style.width = "0%";
        dom.scanProgressBar.style.background = "var(--red)";

        await sleep(2000);
        resetToUpload();
    }
}

// ── Render Results ──────────────────────────────────────────────

function renderResults(data) {
    dom.scanning.classList.add("hidden");
    dom.results.classList.remove("hidden");

    const { analyzers, verdict, total_time_ms, image_size } = data;

    // ── Verdict ──
    renderVerdict(verdict, total_time_ms, image_size);

    // ── CNN Panel ──
    if (analyzers.cnn) {
        renderCNN(analyzers.cnn);
    }

    // ── ELA Panel ──
    if (analyzers.ela) {
        renderELA(analyzers.ela);
    }

    // ── Frequency Panel ──
    if (analyzers.frequency) {
        renderFrequency(analyzers.frequency);
    }

    // ── Noise Panel ──
    if (analyzers.noise) {
        renderNoise(analyzers.noise);
    }

    // ── Metadata Panel ──
    if (analyzers.metadata) {
        renderMetadata(analyzers.metadata);
    }

    // Scroll to results
    dom.results.scrollIntoView({ behavior: "smooth" });
}

// ── Verdict Rendering ───────────────────────────────────────────

function renderVerdict(verdict, totalMs, imageSize) {
    // Animate score
    animateCount(dom.verdictScore, 0, Math.round(verdict.score * 100), 1500);

    // Label
    dom.verdictLabel.textContent = verdict.label;
    dom.verdictLabel.style.color = verdict.color;
    dom.verdictLabel.style.borderBottom = `2px solid ${verdict.color}`;

    // Summary
    dom.verdictSummary.textContent = verdict.summary;

    // Meta
    dom.analysisTime.textContent = `${(totalMs / 1000).toFixed(1)}s`;
    if (imageSize) {
        dom.imageDims.textContent = `${imageSize.width} × ${imageSize.height}`;
    }

    // Banner border glow
    dom.verdictBanner.style.borderColor = verdict.color;
    dom.verdictBanner.style.boxShadow = `0 0 40px ${verdict.color}33`;

    // Draw gauge
    drawGauge(verdict.score, verdict.color);
}

function drawGauge(score, color) {
    const canvas = dom.verdictGauge;
    const ctx = canvas.getContext("2d");
    const size = 200;
    const cx = size / 2;
    const cy = size / 2;
    const radius = 80;
    const lineWidth = 10;

    canvas.width = size;
    canvas.height = size;

    const startAngle = 0.75 * Math.PI;
    const totalAngle = 1.5 * Math.PI;

    // Animate the gauge
    let currentAngle = 0;
    const targetAngle = score * totalAngle;

    function drawFrame() {
        ctx.clearRect(0, 0, size, size);

        // Background track
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + totalAngle);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();

        // Filled arc
        if (currentAngle > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + currentAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "round";
            ctx.stroke();

            // Glow
            ctx.shadowColor = color;
            ctx.shadowBlur = 12;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Tick marks
        for (let i = 0; i <= 10; i++) {
            const angle = startAngle + (i / 10) * totalAngle;
            const innerR = radius - lineWidth - 4;
            const outerR = radius - lineWidth - (i % 5 === 0 ? 12 : 8);
            ctx.beginPath();
            ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
            ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
            ctx.strokeStyle = "rgba(0,0,0,0.1)";
            ctx.lineWidth = i % 5 === 0 ? 2 : 1;
            ctx.stroke();
        }

        if (currentAngle < targetAngle) {
            currentAngle += (targetAngle - currentAngle) * 0.06 + 0.005;
            if (currentAngle > targetAngle) currentAngle = targetAngle;
            requestAnimationFrame(drawFrame);
        }
    }

    drawFrame();
}

// ── Panel Renderers ─────────────────────────────────────────────

function renderCNN(data) {
    // Score badge
    setScoreBadge(dom.cnnScoreBadge, data.score);

    // Prediction
    const predColor =
        data.prediction === "Real"
            ? "var(--green)"
            : data.prediction === "AI-Generated"
                ? "var(--red)"
                : "var(--amber)";

    dom.cnnPrediction.innerHTML = `
        <span class="pred-label" style="background: ${predColor}22; color: ${predColor}; border: 1px solid ${predColor}44;">
            ${data.prediction}
        </span>
        <span class="pred-confidence">${data.confidence}% confidence</span>
    `;

    // Description
    dom.cnnDescription.textContent = data.description;

    // Grad-CAM
    if (data.gradcam_b64) {
        dom.cnnGradcam.innerHTML = `<img src="data:image/png;base64,${data.gradcam_b64}" alt="Grad-CAM visualization">`;
    }
}

function renderELA(data) {
    setScoreBadge(dom.elaScoreBadge, data.score);
    dom.elaDescription.textContent = data.description;

    if (data.heatmap_b64) {
        dom.elaHeatmap.innerHTML = `<img src="data:image/png;base64,${data.heatmap_b64}" alt="ELA heatmap">`;
    }
}

function renderFrequency(data) {
    setScoreBadge(dom.freqScoreBadge, data.score);
    dom.freqDescription.textContent = data.description;

    if (data.spectrum_b64) {
        dom.freqSpectrum.innerHTML = `<img src="data:image/png;base64,${data.spectrum_b64}" alt="Frequency spectrum">`;
    }

    // Radial profile chart
    if (data.radial_profile_data && data.radial_profile_data.length > 0) {
        renderFrequencyChart(data.radial_profile_data);
    }
}

function renderFrequencyChart(profileData) {
    if (freqChartInstance) {
        freqChartInstance.destroy();
    }

    const ctx = dom.freqChart.getContext("2d");

    freqChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: profileData.map((d) => d.frequency),
            datasets: [
                {
                    label: "Radial Power",
                    data: profileData.map((d) => d.power),
                    borderColor: "#8b6cc7",
                    backgroundColor: "rgba(139, 108, 199, 0.1)",
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(255,255,255,0.4)",
                    titleColor: "#2a2430",
                    bodyColor: "#524a5c",
                    borderColor: "rgba(255,255,255,0.5)",
                    borderWidth: 1,
                },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Frequency",
                        color: "#55556a",
                        font: { family: "'JetBrains Mono'", size: 10 },
                    },
                    ticks: { color: "#847a8e", font: { size: 9 }, maxTicksLimit: 8 },
                    grid: { color: "rgba(0,0,0,0.04)" },
                },
                y: {
                    title: {
                        display: true,
                        text: "Normalized Power",
                        color: "#847a8e",
                        font: { family: "'JetBrains Mono'", size: 10 },
                    },
                    ticks: { color: "#847a8e", font: { size: 9 }, maxTicksLimit: 5 },
                    grid: { color: "rgba(0,0,0,0.04)" },
                },
            },
        },
    });
}

function renderNoise(data) {
    setScoreBadge(dom.noiseScoreBadge, data.score);
    dom.noiseDescription.textContent = data.description;

    if (data.noise_map_b64) {
        dom.noiseMap.innerHTML = `<img src="data:image/png;base64,${data.noise_map_b64}" alt="Noise variance map">`;
    }
}

function renderMetadata(data) {
    setScoreBadge(dom.metaScoreBadge, data.score);
    dom.metaDescription.textContent = data.description;

    // Flags
    if (data.flags && data.flags.length > 0) {
        dom.metaFlags.innerHTML = data.flags
            .map((flag) => {
                const icon =
                    flag.type === "danger" ? "🚨" : flag.type === "warning" ? "⚠️" : "ℹ️";
                return `
                    <div class="meta-flag flag-${flag.type}">
                        <span class="meta-flag-icon">${icon}</span>
                        <span>${escapeHtml(flag.message)}</span>
                    </div>
                `;
            })
            .join("");
    }

    // Details table
    if (data.metadata) {
        const exif = data.metadata.exif || {};
        const rows = Object.entries(exif)
            .filter(([k, v]) => typeof v === "string" && v.length < 150)
            .slice(0, 20);

        if (rows.length > 0) {
            dom.metaDetails.innerHTML = `
                <table>
                    <tbody>
                        ${rows
                    .map(
                        ([key, val]) => `
                            <tr>
                                <th>${escapeHtml(key)}</th>
                                <td>${escapeHtml(val)}</td>
                            </tr>
                        `
                    )
                    .join("")}
                    </tbody>
                </table>
            `;
        } else {
            dom.metaDetails.innerHTML = `
                <p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">
                    No readable EXIF data found in this image.
                </p>
            `;
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────

function setScoreBadge(element, score) {
    const pct = Math.round(score * 100);
    let color;

    if (score < 0.3) color = "#4dd4ac";
    else if (score < 0.5) color = "#84cc16";
    else if (score < 0.65) color = "#e8a840";
    else if (score < 0.8) color = "#e07ab5";
    else color = "#e06070";

    element.textContent = `${pct}%`;
    element.style.color = color;
    element.style.background = `${color}18`;
    element.style.border = `1px solid ${color}40`;
}

function animateCount(element, from, to, duration) {
    const start = performance.now();

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(from + (to - from) * eased);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
