"""
Analysis Pipeline Orchestrator
================================
Runs all forensic analysis modules and aggregates their results
into a unified verdict with weighted scoring.
"""

import time
import traceback
from PIL import Image

from .analyzers import (
    ELAAnalyzer,
    FrequencyAnalyzer,
    NoiseAnalyzer,
    MetadataAnalyzer,
    CNNClassifier,
)


class ForensicPipeline:
    """
    Orchestrates the full forensic analysis pipeline.
    Runs all analyzers and produces a unified result.
    """

    # Weights for each analyzer in the final verdict
    WEIGHTS = {
        "cnn": 0.35,
        "ela": 0.20,
        "frequency": 0.20,
        "noise": 0.15,
        "metadata": 0.10,
    }

    def __init__(self):
        self.ela = ELAAnalyzer()
        self.frequency = FrequencyAnalyzer()
        self.noise = NoiseAnalyzer()
        self.metadata = MetadataAnalyzer()
        self.cnn = CNNClassifier()

    def analyze(self, image: Image.Image) -> dict:
        """
        Run the full forensic analysis pipeline.

        Args:
            image: PIL Image to analyze

        Returns:
            dict with individual analyzer results + unified verdict
        """
        start_time = time.time()
        results = {}
        errors = {}

        # Run each analyzer, catching individual failures
        analyzers = {
            "ela": ("Error Level Analysis", self.ela),
            "frequency": ("Frequency Analysis", self.frequency),
            "noise": ("Noise Analysis", self.noise),
            "metadata": ("Metadata Analysis", self.metadata),
            "cnn": ("CNN Classification", self.cnn),
        }

        for key, (name, analyzer) in analyzers.items():
            try:
                print(f"[Pipeline] Running {name}...")
                t = time.time()
                results[key] = analyzer.analyze(image)
                elapsed = time.time() - t
                results[key]["elapsed_ms"] = round(elapsed * 1000)
                print(f"[Pipeline] {name} completed in {elapsed:.2f}s")
            except Exception as e:
                print(f"[Pipeline] {name} FAILED: {e}")
                traceback.print_exc()
                errors[key] = str(e)
                results[key] = {
                    "score": 0.5,
                    "prediction": "Error",
                    "confidence": 0,
                    "description": f"Analysis failed: {str(e)}",
                    "error": True,
                    "gradcam_b64": None
                }

        # Compute unified verdict
        verdict = self._compute_verdict(results)

        total_time = time.time() - start_time

        return {
            "analyzers": results,
            "verdict": verdict,
            "errors": errors if errors else None,
            "total_time_ms": round(total_time * 1000),
        }

    def _compute_verdict(self, results: dict) -> dict:
        """
        Compute a smart verdict from all analyzer scores.
        
        Strategy: The CNN classifier is the most reliable signal for
        AI-generated content. Traditional forensic methods (ELA, frequency,
        noise) detect editing/splicing but often score LOW for pure AI-generated
        images (which have no compression artifacts or splicing traces).
        
        So we use a CNN-dominant approach:
        - If CNN confidence is high (>85%), it gets 60% weight
        - Traditional methods serve as supporting evidence, not overrides
        - A strong CNN score cannot be diluted by low traditional scores
        """
        cnn_score = results.get("cnn", {}).get("score", 0.5)
        cnn_has_error = results.get("cnn", {}).get("error", False)
        
        # Gather traditional analyzer scores
        traditional_keys = ["ela", "frequency", "noise", "metadata"]
        trad_scores = []
        for key in traditional_keys:
            if key in results and not results[key].get("error"):
                trad_scores.append(results[key].get("score", 0.5))
        
        trad_avg = sum(trad_scores) / len(trad_scores) if trad_scores else 0.5
        
        if cnn_has_error:
            # CNN failed — fall back to traditional only
            final_score = trad_avg
        else:
            cnn_confidence = abs(cnn_score - 0.5) * 2  # 0 to 1 scale
            
            if cnn_confidence > 0.7:  # CNN is highly confident (>85% or <15%)
                # CNN-dominant: 60% CNN, 40% traditional
                final_score = cnn_score * 0.60 + trad_avg * 0.40
                
                # Boost: if CNN is extremely confident (>95%), push further
                if cnn_confidence > 0.9:
                    # Ensure the final score moves towards the CNN's direction
                    final_score = cnn_score * 0.75 + trad_avg * 0.25
            else:
                # CNN is uncertain — equal weighting
                final_score = cnn_score * 0.40 + trad_avg * 0.60
        
        # Clamp
        final_score = max(0.0, min(1.0, final_score))
        
        print(f"[Verdict] CNN={cnn_score:.3f}, Traditional avg={trad_avg:.3f}, Final={final_score:.3f}")

        # Determine verdict label
        if final_score < 0.25:
            label = "LIKELY REAL"
            color = "#22c55e"  # green
            summary = "This image appears to be an authentic photograph. Multiple forensic analyses found no significant indicators of AI generation or manipulation."
        elif final_score < 0.40:
            label = "PROBABLY REAL"
            color = "#84cc16"  # lime
            summary = "This image is more likely real than fake, though some minor anomalies were detected. These could be due to post-processing or image compression."
        elif final_score < 0.55:
            label = "INCONCLUSIVE"
            color = "#f59e0b"  # amber
            summary = "This image shows mixed signals. Some forensic indicators suggest possible AI generation or manipulation, but results are inconclusive."
        elif final_score < 0.70:
            label = "SUSPICIOUS"
            color = "#f97316"  # orange
            summary = "Multiple forensic analyses indicate this image may be AI-generated. Several detection methods flagged suspicious patterns."
        elif final_score < 0.85:
            label = "LIKELY AI-GENERATED"
            color = "#ef4444"  # red
            summary = "Strong evidence suggests this image is AI-generated. The neural network and supporting forensic analyses detected patterns consistent with artificial image synthesis."
        else:
            label = "AI-GENERATED"
            color = "#dc2626"  # deep red
            summary = "This image is almost certainly AI-generated. The neural network classifier is highly confident and forensic analyses confirm patterns typical of AI synthesis."

        return {
            "score": round(final_score, 3),
            "label": label,
            "color": color,
            "summary": summary,
            "confidence": round(abs(final_score - 0.5) * 200, 1),
        }

