"""
Error Level Analysis (ELA) Module
==================================
Detects image manipulation by re-compressing the image at a known JPEG quality
and computing the difference. Tampered regions show different error levels
because they've been through a different compression history.
"""

import io
import base64
import numpy as np
from PIL import Image, ImageChops, ImageEnhance
import cv2


class ELAAnalyzer:
    """
    Performs Error Level Analysis on images to detect potential manipulation.
    """

    QUALITY = 90  # JPEG re-compression quality
    SCALE_FACTOR = 15  # Amplification factor for visualization

    def analyze(self, image: Image.Image) -> dict:
        """
        Run ELA on the given PIL Image.

        Returns:
            dict with keys:
                - score (float 0-1): suspicion score (higher = more suspicious)
                - heatmap_b64 (str): base64-encoded PNG of the ELA heatmap
                - description (str): human-readable interpretation
        """
        # Convert to RGB if necessary
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Re-save at known quality
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=self.QUALITY)
        buffer.seek(0)
        resaved = Image.open(buffer)

        # Compute absolute difference
        diff = ImageChops.difference(image, resaved)

        # Amplify differences for visibility
        extrema = diff.getextrema()
        max_diff = max([ex[1] for ex in extrema])
        if max_diff == 0:
            max_diff = 1

        scale = 255.0 / max_diff
        diff_amplified = ImageEnhance.Brightness(diff).enhance(scale * 0.5)

        # Convert to numpy for analysis
        diff_array = np.array(diff, dtype=np.float32)
        diff_gray = np.mean(diff_array, axis=2)

        # Compute suspicion score based on distribution of error levels
        mean_error = np.mean(diff_gray)
        std_error = np.std(diff_gray)

        # High std relative to mean suggests inconsistent compression history
        # (different regions compressed differently = manipulation)
        if mean_error > 0:
            coefficient_of_variation = std_error / mean_error
        else:
            coefficient_of_variation = 0

        # Score: normalize CV into 0-1 range
        # Typical authentic images have CV around 0.5-1.5
        # Manipulated images often have CV > 2.0
        score = min(1.0, max(0.0, (coefficient_of_variation - 0.5) / 3.0))

        # Generate colored heatmap
        heatmap = self._generate_heatmap(diff_gray)
        heatmap_b64 = self._image_to_base64(heatmap)

        # Interpretation
        if score < 0.3:
            description = "Error levels appear consistent across the image. No obvious signs of localized manipulation detected."
        elif score < 0.6:
            description = "Some variation in error levels detected. Certain regions may have been edited or the image may have been through multiple compression cycles."
        else:
            description = "Significant inconsistencies in error levels detected. Multiple regions show different compression histories, which is a strong indicator of manipulation."

        return {
            "score": round(score, 3),
            "heatmap_b64": heatmap_b64,
            "description": description,
            "stats": {
                "mean_error": round(float(mean_error), 2),
                "std_error": round(float(std_error), 2),
                "coefficient_of_variation": round(float(coefficient_of_variation), 3),
            },
        }

    def _generate_heatmap(self, diff_gray: np.ndarray) -> Image.Image:
        """Generate a colored heatmap from the grayscale difference map."""
        # Normalize to 0-255
        normalized = np.clip(diff_gray * self.SCALE_FACTOR, 0, 255).astype(np.uint8)

        # Apply colormap
        heatmap = cv2.applyColorMap(normalized, cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

        return Image.fromarray(heatmap_rgb)

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        """Convert PIL Image to base64 PNG string."""
        buffer = io.BytesIO()
        image.save(buffer, "PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
