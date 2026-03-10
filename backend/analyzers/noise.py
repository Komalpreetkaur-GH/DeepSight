"""
Noise Pattern Analysis Module
==============================
Authentic photographs have consistent sensor noise from the camera's CCD/CMOS.
Manipulated or AI-generated images often have inconsistent noise patterns
across different regions, which this module detects.
"""

import io
import base64
import numpy as np
from PIL import Image
import cv2


class NoiseAnalyzer:
    """
    Analyzes noise patterns in images to detect manipulation.
    Authentic images have uniform sensor noise; manipulated ones don't.
    """

    BLOCK_SIZE = 64  # Size of blocks for local noise analysis

    def analyze(self, image: Image.Image) -> dict:
        """
        Run noise pattern analysis on the given PIL Image.

        Returns:
            dict with keys:
                - score (float 0-1): inconsistency score
                - noise_map_b64 (str): base64-encoded noise variance map
                - description (str): human-readable interpretation
        """
        if image.mode != "RGB":
            image = image.convert("RGB")

        img_array = np.array(image, dtype=np.float32)

        # Extract noise residual using median filter denoising
        noise_residual = self._extract_noise(img_array)

        # Compute block-wise noise variance map
        variance_map = self._compute_variance_map(noise_residual)

        # Analyze consistency of noise across blocks
        score, stats = self._analyze_consistency(variance_map)

        # Generate visualization
        noise_vis = self._generate_noise_map(variance_map, image.size)
        noise_map_b64 = self._image_to_base64(noise_vis)

        # Interpretation
        if score < 0.3:
            description = "Noise patterns are consistent across the image, typical of an unmanipulated photograph with uniform sensor noise."
        elif score < 0.6:
            description = "Moderate noise inconsistencies detected. Some regions show different noise characteristics, which could indicate partial editing or AI generation."
        else:
            description = "Significant noise pattern inconsistencies found. Different regions of the image exhibit markedly different noise levels, strongly suggesting manipulation or AI generation."

        return {
            "score": round(score, 3),
            "noise_map_b64": noise_map_b64,
            "description": description,
            "stats": stats,
        }

    def _extract_noise(self, img_array: np.ndarray) -> np.ndarray:
        """
        Extract noise residual by subtracting a denoised version.
        Uses median filtering as a robust denoiser.
        """
        # Convert to uint8 for OpenCV
        img_uint8 = np.clip(img_array, 0, 255).astype(np.uint8)

        # Apply median blur (denoising)
        denoised = cv2.medianBlur(img_uint8, 5)

        # Noise residual = original - denoised
        noise = img_array - denoised.astype(np.float32)

        return noise

    def _compute_variance_map(self, noise: np.ndarray) -> np.ndarray:
        """
        Compute a block-wise variance map of the noise residual.
        Each block gets a single variance value.
        """
        h, w = noise.shape[:2]
        bs = self.BLOCK_SIZE

        # Number of blocks
        n_rows = h // bs
        n_cols = w // bs

        if n_rows == 0 or n_cols == 0:
            # Image too small for block analysis
            return np.array([[np.var(noise)]])

        variance_map = np.zeros((n_rows, n_cols))

        for i in range(n_rows):
            for j in range(n_cols):
                block = noise[i * bs : (i + 1) * bs, j * bs : (j + 1) * bs]
                variance_map[i, j] = np.var(block)

        return variance_map

    def _analyze_consistency(self, variance_map: np.ndarray) -> tuple:
        """
        Analyze the consistency of noise variance across blocks.
        Returns (score, stats_dict).
        """
        flat = variance_map.flatten()

        if len(flat) < 4:
            return 0.1, {"mean_variance": 0, "std_variance": 0, "blocks_analyzed": len(flat)}

        mean_var = np.mean(flat)
        std_var = np.std(flat)
        median_var = np.median(flat)

        # Coefficient of variation of block variances
        if mean_var > 0:
            cv = std_var / mean_var
        else:
            cv = 0

        # Also check for outlier blocks (regions with very different noise)
        q1, q3 = np.percentile(flat, [25, 75])
        iqr = q3 - q1
        n_outliers = np.sum((flat < q1 - 1.5 * iqr) | (flat > q3 + 1.5 * iqr))
        outlier_ratio = n_outliers / len(flat)

        # Combined score
        cv_score = min(1.0, cv / 2.0)  # CV > 2 → max score
        outlier_score = min(1.0, outlier_ratio * 5)  # 20% outliers → max score
        score = 0.6 * cv_score + 0.4 * outlier_score

        stats = {
            "mean_variance": round(float(mean_var), 2),
            "std_variance": round(float(std_var), 2),
            "median_variance": round(float(median_var), 2),
            "outlier_blocks": int(n_outliers),
            "total_blocks": int(len(flat)),
            "coefficient_of_variation": round(float(cv), 3),
        }

        return round(score, 3), stats

    def _generate_noise_map(
        self, variance_map: np.ndarray, original_size: tuple
    ) -> Image.Image:
        """Generate a colored noise variance heatmap at the original image size."""
        # Normalize variance map
        v_min, v_max = variance_map.min(), variance_map.max()
        if v_max - v_min > 0:
            normalized = ((variance_map - v_min) / (v_max - v_min) * 255).astype(
                np.uint8
            )
        else:
            normalized = np.zeros_like(variance_map, dtype=np.uint8)

        # Resize to original image size
        w, h = original_size
        resized = cv2.resize(normalized, (w, h), interpolation=cv2.INTER_CUBIC)

        # Apply colormap
        heatmap = cv2.applyColorMap(resized, cv2.COLORMAP_VIRIDIS)
        heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

        return Image.fromarray(heatmap_rgb)

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, "PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
