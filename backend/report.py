"""
PDF Forensic Report Generator
================================
Generates a downloadable PDF report with verdict, analyzer results,
and embedded visualization images.
"""

import io
import base64
import datetime
from PIL import Image as PILImage

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


def _b64_to_image(b64_str: str, max_width=450, max_height=250) -> Image:
    """Convert a base64-encoded PNG to a reportlab Image object."""
    img_data = base64.b64decode(b64_str)
    img_buf = io.BytesIO(img_data)

    # Get original size
    pil = PILImage.open(io.BytesIO(img_data))
    w, h = pil.size

    # Scale to fit
    ratio = min(max_width / w, max_height / h, 1.0)
    return Image(img_buf, width=w * ratio, height=h * ratio)


def generate_report(analysis_data: dict) -> bytes:
    """
    Generate a PDF forensic report from analysis results.

    Args:
        analysis_data: The full analysis result dict from the pipeline

    Returns:
        PDF file contents as bytes
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=30 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontSize=24,
        textColor=colors.HexColor("#06d6a0"),
        spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#8888a0"),
        alignment=TA_CENTER,
        spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#06d6a0"),
        spaceBefore=16,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "VerdictText",
        parent=styles["Normal"],
        fontSize=20,
        textColor=colors.white,
        alignment=TA_CENTER,
        fontName="Helvetica-Bold",
        spaceAfter=4,
    ))
    styles.add(ParagraphStyle(
        "BodyText2",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#cccccc"),
        leading=14,
        spaceAfter=8,
    ))
    styles.add(ParagraphStyle(
        "SmallMono",
        parent=styles["Normal"],
        fontSize=8,
        fontName="Courier",
        textColor=colors.HexColor("#aaaacc"),
        leading=10,
    ))

    elements = []

    # ── Title Page ──
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("🔍 DeepSight", styles["ReportTitle"]))
    elements.append(Paragraph("Forensic Analysis Report", styles["ReportSubtitle"]))
    elements.append(Spacer(1, 10))

    # Date & file info
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    filename = analysis_data.get("filename", "Unknown")
    img_size = analysis_data.get("image_size", {})
    dims = f"{img_size.get('width', '?')} × {img_size.get('height', '?')}"
    time_ms = analysis_data.get("total_time_ms", 0)

    info_data = [
        ["File", filename],
        ["Dimensions", dims],
        ["Analysis Time", f"{time_ms / 1000:.1f}s"],
        ["Report Date", now],
    ]
    info_table = Table(info_data, colWidths=[100, 350])
    info_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#8888a0")),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.white),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#333355")),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 20))

    # ── Verdict ──
    verdict = analysis_data.get("verdict", {})
    v_label = verdict.get("label", "UNKNOWN")
    v_score = verdict.get("score", 0)
    v_summary = verdict.get("summary", "")
    v_color = verdict.get("color", "#ffffff")

    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#333355")))
    elements.append(Spacer(1, 10))
    elements.append(Paragraph("VERDICT", styles["SectionHeader"]))

    verdict_data = [[
        Paragraph(f'<font color="{v_color}" size="18"><b>{v_label}</b></font>', styles["VerdictText"]),
        Paragraph(f'<font color="{v_color}" size="16"><b>{int(v_score * 100)}%</b></font>', styles["VerdictText"]),
    ]]
    verdict_table = Table(verdict_data, colWidths=[350, 100])
    verdict_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#12121a")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor(v_color)),
        ("PADDING", (0, 0), (-1, -1), 14),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(verdict_table)
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(v_summary, styles["BodyText2"]))
    elements.append(Spacer(1, 10))

    # ── Per-Analyzer Sections ──
    analyzers = analysis_data.get("analyzers", {})
    analyzer_info = [
        ("cnn", "Neural Network Classification", "gradcam_b64"),
        ("ela", "Error Level Analysis", "heatmap_b64"),
        ("frequency", "Frequency Analysis", "spectrum_b64"),
        ("noise", "Noise Analysis", "noise_map_b64"),
        ("metadata", "Metadata Analysis", None),
    ]

    for key, title, img_key in analyzer_info:
        data = analyzers.get(key, {})
        if not data:
            continue

        score = data.get("score", 0)
        description = data.get("description", "No description available.")
        elapsed = data.get("elapsed_ms", 0)

        elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#333355")))
        elements.append(Paragraph(f"{title}", styles["SectionHeader"]))

        # Score badge
        score_color = (
            "#22c55e" if score < 0.3 else
            "#84cc16" if score < 0.5 else
            "#f59e0b" if score < 0.65 else
            "#f97316" if score < 0.8 else
            "#ef4444"
        )
        elements.append(Paragraph(
            f'<font color="{score_color}" size="12"><b>Score: {int(score * 100)}%</b></font>'
            f'  <font color="#555" size="8">({elapsed}ms)</font>',
            styles["BodyText2"],
        ))
        elements.append(Paragraph(description, styles["BodyText2"]))

        # CNN-specific: prediction
        if key == "cnn" and "prediction" in data:
            pred = data["prediction"]
            conf = data.get("confidence", 0)
            elements.append(Paragraph(
                f'<b>Prediction:</b> {pred} ({conf}% confidence)',
                styles["BodyText2"],
            ))

        # Visualization image
        if img_key and data.get(img_key):
            try:
                img = _b64_to_image(data[img_key])
                elements.append(Spacer(1, 6))
                elements.append(img)
            except Exception:
                pass

        # Metadata-specific: flags
        if key == "metadata" and data.get("flags"):
            elements.append(Spacer(1, 6))
            for flag in data["flags"]:
                icon = "⚠" if flag.get("type") == "warning" else "🔴" if flag.get("type") == "danger" else "ℹ"
                elements.append(Paragraph(
                    f'{icon} {flag.get("message", "")}',
                    styles["BodyText2"],
                ))

        elements.append(Spacer(1, 10))

    # ── Footer ──
    elements.append(Spacer(1, 20))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#333355")))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(
        "Generated by DeepSight — Deepfake Forensics Toolkit",
        styles["SmallMono"],
    ))

    doc.build(elements)
    return buf.getvalue()
