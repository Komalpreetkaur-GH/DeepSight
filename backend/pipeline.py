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
                    "description": f"Analysis failed: {str(e)}",
                    "error": True,
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
        Compute a weighted verdict from all analyzer scores.
        """
        weighted_score = 0.0
        total_weight = 0.0

        for key, weight in self.WEIGHTS.items():
            if key in results and not results[key].get("error"):
                score = results[key].get("score", 0.5)
                weighted_score += score * weight
                total_weight += weight

        if total_weight > 0:
            final_score = weighted_score / total_weight
        else:
            final_score = 0.5

        # Determine verdict label
        if final_score < 0.3:
            label = "LIKELY REAL"
            color = "#22c55e"  # green
            summary = "This image appears to be an authentic photograph. Multiple forensic analyses found no significant indicators of AI generation or manipulation."
        elif final_score < 0.5:
            label = "PROBABLY REAL"
            color = "#84cc16"  # lime
            summary = "This image is more likely real than fake, though some minor anomalies were detected. These could be due to post-processing or image compression."
        elif final_score < 0.65:
            label = "SUSPICIOUS"
            color = "#f59e0b"  # amber
            summary = "This image shows mixed signals. Some forensic indicators suggest possible AI generation or manipulation, but results are inconclusive."
        elif final_score < 0.8:
            label = "PROBABLY AI-GENERATED"
            color = "#f97316"  # orange
            summary = "Multiple forensic analyses indicate this image is likely AI-generated. Several detection methods flagged suspicious patterns."
        else:
            label = "LIKELY AI-GENERATED"
            color = "#ef4444"  # red
            summary = "Strong evidence suggests this image is AI-generated. Multiple forensic techniques detected patterns consistent with artificial image synthesis."

        return {
            "score": round(final_score, 3),
            "label": label,
            "color": color,
            "summary": summary,
            "confidence": round(abs(final_score - 0.5) * 200, 1),
        }
