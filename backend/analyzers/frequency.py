"""
Frequency Domain Analysis Module
=================================
AI-generated images (especially GAN-produced) often exhibit distinctive patterns
in the frequency domain — such as checkerboard artifacts in high-frequency
components or unusual spectral energy distributions.
"""

import io
import base64
import numpy as np
from PIL import Image
import cv2


class FrequencyAnalyzer:
    """
    Analyzes the frequency spectrum of images to detect GAN artifacts
    and other AI-generation signatures.
    """

    def analyze(self, image: Image.Image) -> dict:
        """
        Run frequency domain analysis on the given PIL Image.

        Returns:
            dict with keys:
                - score (float 0-1): anomaly score
                - spectrum_b64 (str): base64-encoded frequency spectrum image
                - radial_profile_data (list): radial power spectrum data
                - description (str): human-readable interpretation
        """
        # Convert to grayscale numpy array
        if image.mode != "L":
            gray = image.convert("L")
        else:
            gray = image
        img_array = np.array(gray, dtype=np.float32)

        # Compute 2D FFT
        f_transform = np.fft.fft2(img_array)
        f_shift = np.fft.fftshift(f_transform)
        magnitude = np.abs(f_shift)
        magnitude_log = np.log1p(magnitude)

        # Compute radial power spectrum
        radial_profile = self._radial_profile(magnitude)

        # Analyze frequency distribution for anomalies
        score, anomaly_details = self._detect_anomalies(magnitude, radial_profile)

        # Generate spectrum visualization
        spectrum_img = self._generate_spectrum_image(magnitude_log)
        spectrum_b64 = self._image_to_base64(spectrum_img)

        # Prepare radial profile data for charting (sample 100 points)
        profile_normalized = radial_profile / (np.max(radial_profile) + 1e-10)
        step = max(1, len(profile_normalized) // 100)
        radial_data = [
            {"frequency": int(i), "power": round(float(profile_normalized[i]), 4)}
            for i in range(0, len(profile_normalized), step)
        ]

        # Interpretation
        if score < 0.3:
            description = "Frequency spectrum appears natural. The power distribution follows expected patterns for authentic photographs."
        elif score < 0.6:
            description = f"Some spectral anomalies detected. {anomaly_details}. This could indicate AI generation or heavy post-processing."
        else:
            description = f"Significant spectral anomalies found. {anomaly_details}. The frequency distribution is atypical for natural photographs and suggests AI generation."

        return {
            "score": round(score, 3),
            "spectrum_b64": spectrum_b64,
            "radial_profile_data": radial_data,
            "description": description,
        }

    def _radial_profile(self, magnitude: np.ndarray) -> np.ndarray:
        """Compute the radial average (azimuthal average) of the 2D spectrum."""
        h, w = magnitude.shape
        cy, cx = h // 2, w // 2

        # Create radial distance map
        y, x = np.ogrid[:h, :w]
        r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2).astype(int)

        # Compute mean magnitude at each radius
        max_r = min(cy, cx)
        profile = np.zeros(max_r)
        for i in range(max_r):
            mask = r == i
            if np.any(mask):
                profile[i] = np.mean(magnitude[mask])

        return profile

    def _detect_anomalies(
        self, magnitude: np.ndarray, radial_profile: np.ndarray
    ) -> tuple:
        """
        Detect anomalies in the frequency spectrum that indicate AI generation.

        Returns (score, details_string)
        """
        anomalies = []
        scores = []

        # 1. Check high-frequency energy ratio
        # AI images tend to have less high-freq energy or anomalous spikes
        n = len(radial_profile)
        if n > 10:
            low_freq_energy = np.sum(radial_profile[: n // 4])
            high_freq_energy = np.sum(radial_profile[n // 4 :])
            total_energy = low_freq_energy + high_freq_energy

            if total_energy > 0:
                hf_ratio = high_freq_energy / total_energy

                # Natural images typically have HF ratio 0.3-0.7
                if hf_ratio < 0.15:
                    anomalies.append(
                        "Unusually low high-frequency energy (possible AI smoothing)"
                    )
                    scores.append(0.7)
                elif hf_ratio > 0.85:
                    anomalies.append(
                        "Unusually high high-frequency energy (possible artifacts)"
                    )
                    scores.append(0.5)
                else:
                    scores.append(max(0, abs(hf_ratio - 0.5) - 0.2))

        # 2. Check for periodic peaks (GAN checkerboard artifacts)
        if n > 20:
            profile_norm = radial_profile / (np.max(radial_profile) + 1e-10)
            # Look for peaks in the high-frequency region
            hf_profile = profile_norm[n // 3 :]
            if len(hf_profile) > 5:
                # Compute local maxima
                from scipy.signal import find_peaks

                peaks, properties = find_peaks(hf_profile, height=0.3, prominence=0.1)
                if len(peaks) > 3:
                    anomalies.append(
                        f"Detected {len(peaks)} periodic peaks in high frequencies (GAN artifact signature)"
                    )
                    scores.append(min(1.0, len(peaks) * 0.15))

        # 3. Check spectral smoothness
        # AI-generated images tend to have smoother spectra in certain bands
        if n > 10:
            profile_diff = np.diff(radial_profile[1 : n // 2])
            smoothness = np.std(profile_diff) / (np.mean(np.abs(profile_diff)) + 1e-10)
            if smoothness < 0.5:
                anomalies.append(
                    "Abnormally smooth spectral decay (uncommon in natural photos)"
                )
                scores.append(0.4)

        detail_str = "; ".join(anomalies) if anomalies else "No specific anomalies"
        final_score = float(np.mean(scores)) if scores else 0.1

        return min(1.0, final_score), detail_str

    def _generate_spectrum_image(self, magnitude_log: np.ndarray) -> Image.Image:
        """Generate a colored visualization of the frequency spectrum."""
        # Normalize to 0-255
        mag_min = magnitude_log.min()
        mag_max = magnitude_log.max()
        if mag_max - mag_min > 0:
            normalized = (
                (magnitude_log - mag_min) / (mag_max - mag_min) * 255
            ).astype(np.uint8)
        else:
            normalized = np.zeros_like(magnitude_log, dtype=np.uint8)

        # Apply colormap for visualization
        colored = cv2.applyColorMap(normalized, cv2.COLORMAP_INFERNO)
        colored_rgb = cv2.cvtColor(colored, cv2.COLOR_BGR2RGB)

        return Image.fromarray(colored_rgb)

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, "PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
