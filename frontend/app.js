/**
 * Specula — Deepfake Forensics Toolkit
 * Frontend Application Logic
 * ================================================
 * Features: single / batch analysis, PDF export,
 * analysis history, and image comparison.
 */

// ── DOM References ──────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
    hero: $("#hero-section"),
    scanning: $("#scanning-section"),
    results: $("#results-section"),
    batchResults: $("#batch-results-section"),
    historySection: $("#history-section"),
    compareSection: $("#compare-section"),

    uploadZone: $("#upload-zone"),
    fileInput: $("#file-input"),
    filePreview: $("#file-preview"),
    previewImage: $("#preview-image"),
    fileName: $("#file-name"),
    fileSize: $("#file-size"),
    analyzeBtn: $("#analyze-btn"),
    resetBtn: $("#reset-btn"),

    // Batch
    batchPreview: $("#batch-preview"),
    batchThumbnails: $("#batch-thumbnails"),
    batchCount: $("#batch-count"),
    batchAnalyzeBtn: $("#batch-analyze-btn"),
    batchResetBtn: $("#batch-reset-btn"),
    batchGrid: $("#batch-grid"),
    batchNewBtn: $("#batch-new-btn"),

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
    downloadPdfBtn: $("#download-pdf-btn"),

    // Nav
    navHistoryBtn: $("#nav-history-btn"),
    navCompareBtn: $("#nav-compare-btn"),
    historyCount: $("#history-count"),

    // History
    historyGrid: $("#history-grid"),
    historyClearBtn: $("#history-clear-btn"),
    historyCloseBtn: $("#history-close-btn"),
    historyEmpty: $("#history-empty"),

    // Compare
    comparePickerA: $("#compare-picker-a"),
    comparePickerB: $("#compare-picker-b"),
    compareResultA: $("#compare-result-a"),
    compareResultB: $("#compare-result-b"),
    compareCloseBtn: $("#compare-close-btn"),
    compareChartContainer: $("#compare-chart-container"),
    compareChart: $("#compare-chart"),

    // URL
    uploadTabs: $("#upload-tabs"),
    tabUpload: $("#tab-upload"),
    tabUrl: $("#tab-url"),
    urlInputZone: $("#url-input-zone"),
    urlInput: $("#url-input"),
    urlAnalyzeBtn: $("#url-analyze-btn"),
    urlError: $("#url-error"),
    themeToggle: $("#theme-toggle"),
    sunIcon: $(".sun-icon"),
    moonIcon: $(".moon-icon"),
};

// ── State ───────────────────────────────────────────────────────
let selectedFile = null;
let selectedFiles = [];
let freqChartInstance = null;
let compareChartInstance = null;
let currentAnalysisData = null;
let compareSlotTarget = null; // 'a' or 'b'
let compareDataA = null;
let compareDataB = null;

const HISTORY_KEY = "specula_history";
const MAX_HISTORY = 20;

// ── History Manager ─────────────────────────────────────────────
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch { return []; }
}

function saveToHistory(data, thumbnailDataUrl) {
    const history = getHistory();
    history.unshift({
        id: Date.now().toString(),
        filename: data.filename,
        verdict: data.verdict,
        analyzers: {
            cnn: { score: data.analyzers?.cnn?.score },
            ela: { score: data.analyzers?.ela?.score },
            frequency: { score: data.analyzers?.frequency?.score },
            noise: { score: data.analyzers?.noise?.score },
            metadata: { score: data.analyzers?.metadata?.score },
        },
        thumbnail: thumbnailDataUrl,
        date: new Date().toISOString(),
        total_time_ms: data.total_time_ms,
    });
    // Keep only recent items
    while (history.length > MAX_HISTORY) history.pop();
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        // localStorage might be full, pop old items
        history.splice(MAX_HISTORY / 2);
        try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch { }
    }
    updateHistoryBadge();
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    updateHistoryBadge();
}

function updateHistoryBadge() {
    const count = getHistory().length;
    dom.historyCount.textContent = count;
    if (count > 0) {
        dom.historyCount.classList.remove("hidden");
    } else {
        dom.historyCount.classList.add("hidden");
    }
}

// ── File Upload Handling ────────────────────────────────────────
dom.uploadZone.addEventListener("click", () => dom.fileInput.click());
dom.fileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 1) {
        handleFileSelect(files[0]);
    } else if (files.length > 1) {
        handleBatchSelect(files);
    }
});

// Drag and drop
dom.uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.uploadZone.classList.add("drag-over");
});
dom.uploadZone.addEventListener("dragleave", () => dom.uploadZone.classList.remove("drag-over"));
dom.uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.uploadZone.classList.remove("drag-over");
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 1) handleFileSelect(files[0]);
    else if (files.length > 1) handleBatchSelect(files);
});

function handleFileSelect(file) {
    if (!file) return;
    selectedFile = file;
    selectedFiles = [];
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
    dom.batchPreview.classList.add("hidden");
}

function handleBatchSelect(files) {
    selectedFiles = files.slice(0, 10);
    selectedFile = null;
    dom.batchThumbnails.innerHTML = "";
    selectedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement("img");
            img.src = e.target.result;
            img.className = "batch-thumb";
            img.title = file.name;
            dom.batchThumbnails.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
    dom.batchCount.textContent = `${selectedFiles.length} images selected`;
    dom.uploadZone.classList.add("hidden");
    dom.filePreview.classList.add("hidden");
    dom.batchPreview.classList.remove("hidden");
}

dom.resetBtn.addEventListener("click", resetToUpload);
dom.analyzeBtn.addEventListener("click", startSingleAnalysis);
dom.newAnalysisBtn.addEventListener("click", resetToUpload);
dom.batchResetBtn.addEventListener("click", resetToUpload);
dom.batchAnalyzeBtn.addEventListener("click", startBatchAnalysis);
dom.batchNewBtn.addEventListener("click", resetToUpload);
dom.urlAnalyzeBtn.addEventListener("click", startUrlAnalysis);
dom.urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") startUrlAnalysis(); });

// Tab switching
dom.tabUpload.addEventListener("click", () => switchUploadMode("upload"));
dom.tabUrl.addEventListener("click", () => switchUploadMode("url"));

function switchUploadMode(mode) {
    dom.tabUpload.classList.toggle("active", mode === "upload");
    dom.tabUrl.classList.toggle("active", mode === "url");
    dom.uploadZone.classList.toggle("hidden", mode !== "upload");
    dom.urlInputZone.classList.toggle("hidden", mode !== "url");
    dom.filePreview.classList.add("hidden");
    dom.batchPreview.classList.add("hidden");
    dom.urlError.classList.add("hidden");
}

function resetToUpload() {
    selectedFile = null;
    selectedFiles = [];
    currentAnalysisData = null;
    dom.fileInput.value = "";
    dom.urlInput.value = "";
    dom.urlError.classList.add("hidden");
    showSection("hero");
    switchUploadMode("upload");
    dom.filePreview.classList.add("hidden");
    dom.batchPreview.classList.add("hidden");
    if (freqChartInstance) { freqChartInstance.destroy(); freqChartInstance = null; }
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSection(section) {
    dom.hero.classList.add("hidden");
    dom.scanning.classList.add("hidden");
    dom.results.classList.add("hidden");
    dom.batchResults.classList.add("hidden");
    dom.historySection.classList.add("hidden");
    dom.compareSection.classList.add("hidden");
    if (section === "hero") dom.hero.classList.remove("hidden");
    else if (section === "scanning") dom.scanning.classList.remove("hidden");
    else if (section === "results") dom.results.classList.remove("hidden");
    else if (section === "batch") dom.batchResults.classList.remove("hidden");
    else if (section === "history") dom.historySection.classList.remove("hidden");
    else if (section === "compare") dom.compareSection.classList.remove("hidden");
}

// ── Single Analysis ─────────────────────────────────────────────
async function startSingleAnalysis() {
    if (!selectedFile) return;
    showSection("scanning");
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
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 8, 90);
        dom.scanProgressBar.style.width = `${progress}%`;
    }, 500);

    try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Analysis failed");
        }
        const data = await response.json();
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        dom.scanProgressBar.style.width = "100%";
        dom.scanStatusText.textContent = "Analysis complete!";
        await sleep(600);

        currentAnalysisData = data;

        // Save thumbnail and result to history
        const thumbnailUrl = dom.previewImage.src;
        saveToHistory(data, thumbnailUrl);

        renderResults(data);
    } catch (error) {
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        dom.scanStatusText.textContent = `Error: ${error.message}`;
        dom.scanProgressBar.style.width = "0%";
        dom.scanProgressBar.style.background = "var(--red)";
        await sleep(2000);
        dom.scanProgressBar.style.background = "";
        resetToUpload();
    }
}

// ── Batch Analysis ──────────────────────────────────────────────
async function startBatchAnalysis() {
    if (selectedFiles.length === 0) return;
    showSection("scanning");
    dom.scanStatusText.textContent = `Analyzing image 1 of ${selectedFiles.length}...`;
    let progress = 0;
    dom.scanProgressBar.style.width = "0%";

    const batchResults = [];
    const thumbnails = {};

    // Read thumbnails first
    for (const file of selectedFiles) {
        thumbnails[file.name] = await readAsDataURL(file);
    }

    // Set the first image in the scan view
    dom.scanImage.src = thumbnails[selectedFiles[0].name];

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        dom.scanStatusText.textContent = `Analyzing image ${i + 1} of ${selectedFiles.length}: ${file.name}`;
        dom.scanImage.src = thumbnails[file.name];
        progress = ((i) / selectedFiles.length) * 100;
        dom.scanProgressBar.style.width = `${progress}%`;

        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/analyze", { method: "POST", body: formData });
            if (!response.ok) throw new Error("Failed");
            const data = await response.json();
            data._thumbnail = thumbnails[file.name];
            batchResults.push(data);
            // Save each to history
            saveToHistory(data, thumbnails[file.name]);
        } catch (e) {
            batchResults.push({
                filename: file.name,
                error: e.message,
                verdict: { label: "ERROR", score: 0, color: "#ef4444", summary: e.message },
                _thumbnail: thumbnails[file.name],
            });
        }
    }

    dom.scanProgressBar.style.width = "100%";
    dom.scanStatusText.textContent = "Batch analysis complete!";
    await sleep(600);
    renderBatchResults(batchResults);
}

function readAsDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function renderBatchResults(results) {
    showSection("batch");
    dom.batchGrid.innerHTML = "";
    results.forEach((data, idx) => {
        const verdict = data.verdict || {};
        const color = verdict.color || "#888";
        const card = document.createElement("div");
        card.className = "batch-card";
        card.innerHTML = `
            <img src="${data._thumbnail || ''}" class="batch-card-img" alt="${data.filename}">
            <div class="batch-card-body">
                <div class="batch-card-name">${escapeHtml(data.filename)}</div>
                <span class="batch-card-verdict" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44;">
                    ${verdict.label || "ERROR"}
                </span>
                <span class="batch-card-score">${Math.round((verdict.score || 0) * 100)}%</span>
            </div>
        `;
        card.addEventListener("click", () => {
            currentAnalysisData = data;
            renderResults(data);
        });
        dom.batchGrid.appendChild(card);
    });
}

// ── PDF Report ──────────────────────────────────────────────────
dom.downloadPdfBtn.addEventListener("click", async () => {
    if (!selectedFile && !currentAnalysisData) return;
    dom.downloadPdfBtn.textContent = "Generating PDF...";
    dom.downloadPdfBtn.disabled = true;

    try {
        // Re-send the file to the report endpoint
        const formData = new FormData();
        if (selectedFile) {
            formData.append("file", selectedFile);
        } else {
            // If no file (loaded from history), we can't regenerate
            dom.downloadPdfBtn.textContent = "Download PDF Report";
            dom.downloadPdfBtn.disabled = false;
            alert("PDF export requires the original image file. Please re-upload the image.");
            return;
        }

        const response = await fetch("/api/report", { method: "POST", body: formData });
        if (!response.ok) throw new Error("PDF generation failed");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Specula_Report_${currentAnalysisData?.filename || "analysis"}.pdf`;
        document.body.appendChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        alert(`PDF generation failed: ${e.message}`);
    }

    dom.downloadPdfBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download PDF Report
    `;
    dom.downloadPdfBtn.disabled = false;
});

// ── Navigation ──────────────────────────────────────────────────
dom.navHistoryBtn.addEventListener("click", () => {
    if (dom.historySection.classList.contains("hidden")) {
        showSection("history");
        renderHistory();
    } else {
        showSection("hero");
        dom.uploadZone.classList.remove("hidden");
    }
});

dom.navCompareBtn.addEventListener("click", () => {
    if (dom.compareSection.classList.contains("hidden")) {
        showSection("compare");
        renderComparePickers();
    } else {
        showSection("hero");
        dom.uploadZone.classList.remove("hidden");
    }
});

dom.historyCloseBtn.addEventListener("click", () => { showSection("hero"); dom.uploadZone.classList.remove("hidden"); });
dom.compareCloseBtn.addEventListener("click", () => { showSection("hero"); dom.uploadZone.classList.remove("hidden"); });
dom.historyClearBtn.addEventListener("click", () => {
    if (confirm("Clear all analysis history?")) {
        clearHistory();
        renderHistory();
    }
});

// ── History Rendering ───────────────────────────────────────────
function renderHistory(selectMode = false, slotTarget = null) {
    const history = getHistory();
    dom.historyGrid.innerHTML = "";
    if (history.length === 0) {
        dom.historyEmpty.classList.remove("hidden");
        return;
    }
    dom.historyEmpty.classList.add("hidden");

    history.forEach((item) => {
        const v = item.verdict || {};
        const color = v.color || "#888";
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML = `
            <img src="${item.thumbnail || ''}" class="history-card-img" alt="${item.filename}" loading="lazy">
            <div class="history-card-body">
                <div class="history-card-name">${escapeHtml(item.filename)}</div>
                <span class="history-card-verdict" style="background: ${color}22; color: ${color}; border: 1px solid ${color}44;">
                    ${v.label || "?"}
                </span>
                <div class="history-card-date">${new Date(item.date).toLocaleDateString()} ${new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `;

        if (selectMode) {
            card.addEventListener("click", () => {
                selectCompareItem(item, slotTarget);
            });
        }

        dom.historyGrid.appendChild(card);
    });
}

// ── Comparison Mode ─────────────────────────────────────────────
function renderComparePickers() {
    compareDataA = null;
    compareDataB = null;
    dom.compareResultA.classList.add("hidden");
    dom.compareResultB.classList.add("hidden");
    dom.comparePickerA.classList.remove("hidden");
    dom.comparePickerB.classList.remove("hidden");
    dom.compareChartContainer.classList.add("hidden");
    if (compareChartInstance) { compareChartInstance.destroy(); compareChartInstance = null; }
}

dom.comparePickerA.addEventListener("click", () => openHistoryForCompare("a"));
dom.comparePickerB.addEventListener("click", () => openHistoryForCompare("b"));

function openHistoryForCompare(slot) {
    compareSlotTarget = slot;
    showSection("history");
    renderHistory(true, slot);
}

function selectCompareItem(item, slot) {
    if (slot === "a") {
        compareDataA = item;
    } else {
        compareDataB = item;
    }
    // Go back to compare view
    showSection("compare");

    // Render selected items
    if (compareDataA) renderCompareSlot(compareDataA, "a");
    if (compareDataB) renderCompareSlot(compareDataB, "b");

    // If both selected, show comparison chart
    if (compareDataA && compareDataB) {
        renderCompareChart();
    }
}

function renderCompareSlot(item, slot) {
    const resultEl = slot === "a" ? dom.compareResultA : dom.compareResultB;
    const pickerEl = slot === "a" ? dom.comparePickerA : dom.comparePickerB;
    const v = item.verdict || {};
    const color = v.color || "#888";
    const analyzers = item.analyzers || {};

    pickerEl.classList.add("hidden");
    resultEl.classList.remove("hidden");

    resultEl.innerHTML = `
        <img src="${item.thumbnail || ''}" alt="${item.filename}">
        <div class="compare-result-verdict" style="color: ${color};">${v.label || "?"} — ${Math.round((v.score || 0) * 100)}%</div>
        <div class="batch-card-name">${escapeHtml(item.filename)}</div>
        <div class="compare-result-scores">
            <div class="compare-result-score"><span>CNN</span><span>${Math.round((analyzers.cnn?.score || 0) * 100)}%</span></div>
            <div class="compare-result-score"><span>ELA</span><span>${Math.round((analyzers.ela?.score || 0) * 100)}%</span></div>
            <div class="compare-result-score"><span>Frequency</span><span>${Math.round((analyzers.frequency?.score || 0) * 100)}%</span></div>
            <div class="compare-result-score"><span>Noise</span><span>${Math.round((analyzers.noise?.score || 0) * 100)}%</span></div>
            <div class="compare-result-score"><span>Metadata</span><span>${Math.round((analyzers.metadata?.score || 0) * 100)}%</span></div>
        </div>
        <div style="margin-top:8px;"><button class="btn-reset" onclick="document.getElementById('compare-picker-${slot}').classList.remove('hidden');document.getElementById('compare-result-${slot}').classList.add('hidden');">Change</button></div>
    `;
}

function renderCompareChart() {
    dom.compareChartContainer.classList.remove("hidden");
    if (compareChartInstance) compareChartInstance.destroy();

    const labels = ["CNN", "ELA", "Frequency", "Noise", "Metadata"];
    const keys = ["cnn", "ela", "frequency", "noise", "metadata"];

    const dataA = keys.map((k) => Math.round(((compareDataA.analyzers?.[k]?.score || 0)) * 100));
    const dataB = keys.map((k) => Math.round(((compareDataB.analyzers?.[k]?.score || 0)) * 100));

    const ctx = dom.compareChart.getContext("2d");
    compareChartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [
                {
                    label: compareDataA.filename || "Image A",
                    data: dataA,
                    backgroundColor: "rgba(6, 214, 160, 0.6)",
                    borderColor: "rgba(6, 214, 160, 1)",
                    borderWidth: 1,
                    borderRadius: 4,
                },
                {
                    label: compareDataB.filename || "Image B",
                    data: dataB,
                    backgroundColor: "rgba(224, 64, 251, 0.6)",
                    borderColor: "rgba(224, 64, 251, 1)",
                    borderWidth: 1,
                    borderRadius: 4,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#8888a0", font: { size: 11 } } },
            },
            scales: {
                x: { ticks: { color: "#55556a" }, grid: { color: "rgba(255,255,255,0.03)" } },
                y: {
                    beginAtZero: true, max: 100,
                    ticks: { color: "#55556a", callback: (v) => v + "%" },
                    grid: { color: "rgba(255,255,255,0.03)" },
                },
            },
        },
    });
}

// ── Render Results (single) ─────────────────────────────────────
function renderResults(data) {
    showSection("results");
    
    const panels = $$(".panel");
    
    // 1. Show skeletons
    panels.forEach(p => p.classList.add("loading-skeleton"));

    // 2. Populate data (verdict is usually shown first)
    const { analyzers, verdict, total_time_ms, image_size } = data;
    renderVerdict(verdict, total_time_ms, image_size);

    // 4. Simulate a tiny "processing" delay for effect, then hide skeletons
    setTimeout(() => {
        if (analyzers.cnn) renderCNN(analyzers.cnn);
        if (analyzers.ela) renderELA(analyzers.ela);
        if (analyzers.frequency) renderFrequency(analyzers.frequency);
        if (analyzers.noise) renderNoise(analyzers.noise);
        if (analyzers.metadata) renderMetadata(analyzers.metadata);
        
        panels.forEach(p => p.classList.remove("loading-skeleton"));
    }, 800);

    dom.results.scrollIntoView({ behavior: "smooth" });
}

// ── Verdict Rendering ───────────────────────────────────────────
function renderVerdict(verdict, totalMs, imageSize) {
    animateCount(dom.verdictScore, 0, Math.round(verdict.score * 100), 1500);
    dom.verdictLabel.textContent = verdict.label;
    dom.verdictLabel.style.color = verdict.color;
    dom.verdictLabel.style.borderBottom = `2px solid ${verdict.color}`;
    dom.verdictSummary.textContent = verdict.summary;
    dom.analysisTime.textContent = `${(totalMs / 1000).toFixed(1)}s`;
    if (imageSize) dom.imageDims.textContent = `${imageSize.width} × ${imageSize.height}`;
    dom.verdictBanner.style.borderColor = verdict.color;
    dom.verdictBanner.style.boxShadow = `0 0 40px ${verdict.color}33`;
    drawGauge(verdict.score, verdict.color);
}

function drawGauge(score, color) {
    const canvas = dom.verdictGauge;
    const ctx = canvas.getContext("2d");
    const size = 200; const cx = size / 2; const cy = size / 2;
    const radius = 80; const lineWidth = 10;
    canvas.width = size; canvas.height = size;
    const startAngle = 0.75 * Math.PI; const totalAngle = 1.5 * Math.PI;
    let currentAngle = 0; const targetAngle = score * totalAngle;

    function drawFrame() {
        ctx.clearRect(0, 0, size, size);
        ctx.beginPath(); ctx.arc(cx, cy, radius, startAngle, startAngle + totalAngle);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.06)"; ctx.lineWidth = lineWidth; ctx.lineCap = "round"; ctx.stroke();
        if (currentAngle > 0) {
            ctx.beginPath(); ctx.arc(cx, cy, radius, startAngle, startAngle + currentAngle);
            ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.lineCap = "round"; ctx.stroke();
            ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.stroke(); ctx.shadowBlur = 0;
        }
        for (let i = 0; i <= 10; i++) {
            const angle = startAngle + (i / 10) * totalAngle;
            const innerR = radius - lineWidth - 4;
            const outerR = radius - lineWidth - (i % 5 === 0 ? 12 : 8);
            ctx.beginPath();
            ctx.moveTo(cx + innerR * Math.cos(angle), cy + innerR * Math.sin(angle));
            ctx.lineTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
            ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = i % 5 === 0 ? 2 : 1; ctx.stroke();
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
    setScoreBadge(dom.cnnScoreBadge, data.score);
    const predColor = data.prediction === "Real" ? "var(--green)" : data.prediction === "AI-Generated" ? "var(--red)" : "var(--amber)";
    dom.cnnPrediction.innerHTML = `
        <span class="pred-label" style="background: ${predColor}22; color: ${predColor}; border: 1px solid ${predColor}44;">${data.prediction}</span>
        <span class="pred-confidence">${data.confidence}% confidence</span>
    `;
    dom.cnnDescription.textContent = data.description;
    if (data.gradcam_b64) {
        if (typeof render3DHeatmap === "function") {
            render3DHeatmap("cnn-gradcam", data.gradcam_b64, 0x32ade6);
        } else {
            dom.cnnGradcam.innerHTML = `<img src="data:image/png;base64,${data.gradcam_b64}" alt="Grad-CAM">`;
        }
    }
}

function renderELA(data) {
    setScoreBadge(dom.elaScoreBadge, data.score);
    dom.elaDescription.textContent = data.description;
    if (data.heatmap_b64) {
        if (typeof render3DHeatmap === "function") {
            render3DHeatmap("ela-heatmap", data.heatmap_b64, 0xff6b4a);
        } else {
            dom.elaHeatmap.innerHTML = `<img src="data:image/png;base64,${data.heatmap_b64}" alt="ELA heatmap">`;
        }
    }
}

function renderFrequency(data) {
    setScoreBadge(dom.freqScoreBadge, data.score);
    dom.freqDescription.textContent = data.description;
    if (data.spectrum_b64) dom.freqSpectrum.innerHTML = `<img src="data:image/png;base64,${data.spectrum_b64}" alt="Spectrum">`;
    if (data.radial_profile_data?.length > 0) renderFrequencyChart(data.radial_profile_data);
}

function renderFrequencyChart(profileData) {
    if (freqChartInstance) freqChartInstance.destroy();
    const ctx = dom.freqChart.getContext("2d");
    freqChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: profileData.map((d) => d.frequency),
            datasets: [{
                label: "Radial Power", data: profileData.map((d) => d.power),
                borderColor: "#818cf8", backgroundColor: "rgba(129, 140, 248, 0.1)",
                borderWidth: 1.5, fill: true, tension: 0.3, pointRadius: 0,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: "#55556a", font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: "rgba(255,255,255,0.03)" } },
                y: { ticks: { color: "#55556a", font: { size: 9 }, maxTicksLimit: 5 }, grid: { color: "rgba(255,255,255,0.03)" } },
            },
        },
    });
}

function renderNoise(data) {
    setScoreBadge(dom.noiseScoreBadge, data.score);
    dom.noiseDescription.textContent = data.description;
    if (data.noise_map_b64) {
        if (typeof render3DHeatmap === "function") {
            render3DHeatmap("noise-map", data.noise_map_b64, 0x30d158);
        } else {
            dom.noiseMap.innerHTML = `<img src="data:image/png;base64,${data.noise_map_b64}" alt="Noise map">`;
        }
    }
}

function renderMetadata(data) {
    setScoreBadge(dom.metaScoreBadge, data.score);
    dom.metaDescription.textContent = data.description;
    if (data.flags?.length > 0) {
        dom.metaFlags.innerHTML = data.flags.map((flag) => {
            const icon = flag.type === "danger" ? "🚨" : flag.type === "warning" ? "⚠️" : "ℹ️";
            return `<div class="meta-flag flag-${flag.type}"><span class="meta-flag-icon">${icon}</span><span>${escapeHtml(flag.message)}</span></div>`;
        }).join("");
    }
    if (data.metadata) {
        const exif = data.metadata.exif || {};
        const rows = Object.entries(exif).filter(([k, v]) => typeof v === "string" && v.length < 150).slice(0, 20);
        if (rows.length > 0) {
            dom.metaDetails.innerHTML = `<table><tbody>${rows.map(([key, val]) =>
                `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(val)}</td></tr>`
            ).join("")}</tbody></table>`;
        } else {
            dom.metaDetails.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 20px;">No readable EXIF data found.</p>`;
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────────
function setScoreBadge(element, score) {
    const pct = Math.round(score * 100);
    let color;
    if (score < 0.3) color = "var(--green)";
    else if (score < 0.5) color = "var(--lime)";
    else if (score < 0.65) color = "var(--amber)";
    else if (score < 0.8) color = "var(--orange)";
    else color = "var(--red)";
    element.textContent = `${pct}%`;
    element.style.color = color;
    element.style.background = `${color}15`;
    element.style.border = `1px solid ${color}33`;
}

function animateCount(element, from, to, duration) {
    const start = performance.now();
    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = Math.round(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(update);
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

// ── URL Analysis ────────────────────────────────────────────────
async function startUrlAnalysis() {
    const url = dom.urlInput.value.trim();
    if (!url) {
        dom.urlError.textContent = "Please enter a URL.";
        dom.urlError.classList.remove("hidden");
        return;
    }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        dom.urlError.textContent = "URL must start with http:// or https://";
        dom.urlError.classList.remove("hidden");
        return;
    }
    dom.urlError.classList.add("hidden");
    showSection("scanning");
    dom.scanImage.src = url;  // Show the image during scanning
    dom.scanStatusText.textContent = "Fetching image from URL...";

    const scanMessages = [
        "Fetching image from URL...",
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
    let progress = 0;
    dom.scanProgressBar.style.width = "0%";
    const progressInterval = setInterval(() => {
        progress = Math.min(progress + Math.random() * 8, 90);
        dom.scanProgressBar.style.width = `${progress}%`;
    }, 500);

    try {
        const response = await fetch("/api/analyze-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Analysis failed");
        }
        const data = await response.json();
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        dom.scanProgressBar.style.width = "100%";
        dom.scanStatusText.textContent = "Analysis complete!";
        await sleep(600);

        currentAnalysisData = data;
        // Use URL as thumbnail for history
        saveToHistory(data, url);
        renderResults(data);
    } catch (error) {
        clearInterval(progressInterval);
        clearInterval(messageInterval);
        dom.scanStatusText.textContent = `Error: ${error.message}`;
        dom.scanProgressBar.style.width = "0%";
        dom.scanProgressBar.style.background = "var(--red)";
        await sleep(2500);
        dom.scanProgressBar.style.background = "";
        resetToUpload();
    }
}

// ── Init ────────────────────────────────────────────────────────
updateHistoryBadge();

// ── UI Interactions ─────────────────────────────────────────────
function createRipple(e) {
    const btn = e.currentTarget;
    const ripple = document.createElement("span");
    ripple.className = "liquid-ripple";

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    btn.appendChild(ripple);
    
    // Remove ripple after animation finishes
    setTimeout(() => ripple.remove(), 600);
}

function initInteractions() {
    // Theme Toggle
    dom.themeToggle.addEventListener('click', toggleTheme);

    // Select all buttons, tabs, and interactive glass elements
    const interactables = $$(
        '.btn-analyze, .btn-reset, .btn-action, .btn-new-analysis, ' +
        '.upload-tab, .nav-btn, .batch-card, .history-card, .logo-badge'
    );
    
    interactables.forEach(item => {
        item.addEventListener('click', createRipple);
    });
}

function toggleTheme(e) {
    const isDark = document.documentElement.hasAttribute('data-theme');
    const targetTheme = isDark ? 'light' : 'dark';
    
    // 1. Position Droplet at button
    const rect = dom.themeToggle.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    
    const droplet = document.createElement('div');
    droplet.className = 'theme-droplet';
    droplet.style.left = `${startX - 10}px`;
    droplet.style.top = `${startY - 10}px`;
    document.body.appendChild(droplet);
    
    // 2. Animate Fall (Vertical to Bottom)
    const viewHeight = window.innerHeight;
    const fallDistance = viewHeight - startY;
    const impactX = startX;
    const impactY = viewHeight; 
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            droplet.style.transform = `translateY(${fallDistance}px) scale(0.6)`;
        });
    });
    
    // 3. Impact & Perform View Transition
    setTimeout(() => {
        // Impact effect at bottom
        const impact = document.createElement('div');
        impact.className = 'droplet-impact-effect';
        impact.style.left = `${impactX - 20}px`;
        impact.style.top = `${impactY - 20}px`;
        document.body.appendChild(impact);
        droplet.remove();
        
        // Use modern View Transition API for flicker-free reveal
        if (document.startViewTransition) {
            document.startViewTransition(() => {
                if (targetTheme === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                localStorage.setItem('theme', targetTheme);
                updateThemeIcons();
            });
        } else {
            // Fallback for older browsers
            if (targetTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
            localStorage.setItem('theme', targetTheme);
            updateThemeIcons();
        }

        // Cleanup impact
        setTimeout(() => impact.remove(), 1000);
        
    }, 1200); // Wait for the long fall
}

function updateThemeIcons() {
    const isDark = document.documentElement.hasAttribute('data-theme');
    dom.sunIcon.classList.toggle('hidden', isDark);
    dom.moonIcon.classList.toggle('hidden', !isDark);
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    updateThemeIcons();
}

// ── Interactive Glass Tilt Logic ────────────────────────────────
function initTiltEffect() {
    const tiltElements = document.querySelectorAll(".glass-tilt");

    tiltElements.forEach(el => {
        el.addEventListener("mousemove", (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Set variables for the specular glint
            el.style.setProperty("--mouse-x", `${(x / rect.width) * 100}%`);
            el.style.setProperty("--mouse-y", `${(y / rect.height) * 100}%`);

            // Calculate rotation (max 10 degrees)
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -10;
            const rotateY = ((x - centerX) / centerX) * 10;

            el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        el.addEventListener("mouseleave", () => {
            el.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg)`;
        });
    });
}

// ── Progressive Disclosure Logic ───────────────────────────────


// ── Liquid Particle Background ──────────────────────────────────
function initLiquidParticles() {
    const canvas = document.getElementById("particle-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let particles = [];
    let w, h;

    const resize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.size = Math.random() * 2 + 0.5;
            this.vx = (Math.random() - 0.5) * 0.4;
            this.vy = (Math.random() - 0.5) * 0.4;
            this.alpha = Math.random() * 0.5 + 0.2;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) this.reset();
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(50, 173, 230, ${this.alpha})`;
            ctx.fill();
        }
    }

    const init = () => {
        particles = [];
        for (let i = 0; i < 60; i++) particles.push(new Particle());
    };
    init();

    const animate = () => {
        ctx.clearRect(0, 0, w, h);
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        requestAnimationFrame(animate);
    };
    animate();

    // Mouse interaction: move particles away
    window.addEventListener("mousemove", (e) => {
        const mx = e.clientX;
        const my = e.clientY;
        particles.forEach(p => {
            const dx = p.x - mx;
            const dy = p.y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 150) {
                const force = (150 - dist) / 150;
                p.x += dx * force * 0.1;
                p.y += dy * force * 0.1;
            }
        });
    });
}

// ── Initialization ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    updateHistoryBadge();
    initInteractions();
    initTiltEffect();
    initLiquidParticles();
    
    // Smooth scroll for nav links if added later
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
});
