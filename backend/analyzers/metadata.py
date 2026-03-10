"""
Metadata / EXIF Analysis Module
=================================
Examines image metadata for signs of AI generation or manipulation.
AI-generated images often have telltale software signatures, missing camera
data, or stripped metadata.
"""

from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS


class MetadataAnalyzer:
    """
    Analyzes image EXIF and metadata for signs of AI generation or editing.
    """

    # Known AI generation software signatures
    AI_SOFTWARE_SIGNATURES = [
        "stable diffusion",
        "midjourney",
        "dall-e",
        "dalle",
        "comfyui",
        "automatic1111",
        "novelai",
        "adobe firefly",
        "firefly",
        "leonardo.ai",
        "playground ai",
        "ideogram",
        "flux",
        "craiyon",
        "deepai",
        "nightcafe",
        "artbreeder",
        "jasper art",
        "canva ai",
        "bing image creator",
        "copilot",
    ]

    # Known editing software
    EDITING_SOFTWARE = [
        "photoshop",
        "gimp",
        "affinity",
        "lightroom",
        "capture one",
        "luminar",
        "pixlr",
        "paint.net",
        "snapseed",
    ]

    def analyze(self, image: Image.Image) -> dict:
        """
        Analyze image metadata for manipulation or AI generation indicators.

        Returns:
            dict with keys:
                - score (float 0-1): suspicion score
                - metadata (dict): extracted metadata
                - flags (list): suspicious findings
                - description (str): human-readable interpretation
        """
        flags = []
        scores = []

        # Extract all metadata
        metadata = self._extract_metadata(image)

        # Check 1: EXIF data presence
        exif_data = metadata.get("exif", {})
        if not exif_data:
            flags.append({
                "type": "warning",
                "message": "No EXIF data found. AI-generated images typically lack EXIF metadata.",
            })
            scores.append(0.4)
        else:
            # Check for camera info
            has_camera = bool(
                exif_data.get("Make") or exif_data.get("Model")
            )
            if not has_camera:
                flags.append({
                    "type": "warning",
                    "message": "No camera make/model found in EXIF. Authentic photos usually contain this.",
                })
                scores.append(0.3)
            else:
                flags.append({
                    "type": "info",
                    "message": f"Camera detected: {exif_data.get('Make', '')} {exif_data.get('Model', '')}",
                })
                scores.append(0.0)

            # Check for GPS data
            if exif_data.get("GPSInfo"):
                flags.append({
                    "type": "info",
                    "message": "GPS location data present — more likely a real photograph.",
                })
                scores.append(0.0)

        # Check 2: Software signatures
        software = str(metadata.get("exif", {}).get("Software", "")).lower()
        # Also check PNG text chunks
        png_params = metadata.get("png_text", {})
        all_text = software + " " + " ".join(
            str(v).lower() for v in png_params.values()
        )

        for sig in self.AI_SOFTWARE_SIGNATURES:
            if sig in all_text:
                flags.append({
                    "type": "danger",
                    "message": f"AI generation software detected: '{sig}'",
                })
                scores.append(0.9)
                break

        for sig in self.EDITING_SOFTWARE:
            if sig in all_text:
                flags.append({
                    "type": "warning",
                    "message": f"Image editing software detected: '{sig}'",
                })
                scores.append(0.3)
                break

        # Check 3: PNG text chunks (Stable Diffusion often stores parameters here)
        sd_keys = ["parameters", "prompt", "negative_prompt", "steps", "sampler", "cfg_scale"]
        for key in sd_keys:
            if key.lower() in {k.lower() for k in png_params.keys()}:
                flags.append({
                    "type": "danger",
                    "message": f"AI generation parameter found in metadata: '{key}'",
                })
                scores.append(0.95)
                break

        # Check 4: Image format and properties
        format_info = metadata.get("format_info", {})
        if format_info.get("format") == "PNG" and not exif_data:
            flags.append({
                "type": "info",
                "message": "PNG format without EXIF — common for AI-generated images shared online.",
            })
            scores.append(0.2)

        # Check 5: Unusual dimensions
        w, h = image.size
        # AI images often come in standard sizes
        ai_sizes = [
            (512, 512), (768, 768), (1024, 1024), (1024, 768), (768, 1024),
            (512, 768), (768, 512), (1024, 576), (576, 1024),
            (1920, 1080), (1080, 1920), (2048, 2048),
        ]
        if (w, h) in ai_sizes:
            flags.append({
                "type": "info",
                "message": f"Image dimensions ({w}x{h}) match common AI generation sizes.",
            })
            scores.append(0.15)

        # Compute final score
        if scores:
            final_score = min(1.0, max(scores) * 0.6 + (sum(scores) / len(scores)) * 0.4)
        else:
            final_score = 0.2  # Neutral if no data to analyze

        # Add flags count if nothing suspicious
        if not any(f["type"] == "danger" for f in flags) and not any(
            f["type"] == "warning" for f in flags
        ):
            flags.append({
                "type": "info",
                "message": "No suspicious metadata patterns detected.",
            })

        # Interpretation
        if final_score < 0.3:
            description = "Metadata analysis shows no red flags. The image contains typical metadata for an authentic photograph."
        elif final_score < 0.6:
            description = "Some metadata anomalies found. Missing or inconsistent metadata could indicate AI generation or post-processing."
        else:
            description = "Metadata strongly suggests AI generation. Signatures of AI tools or telltale metadata patterns were detected."

        return {
            "score": round(final_score, 3),
            "metadata": metadata,
            "flags": flags,
            "description": description,
        }

    def _extract_metadata(self, image: Image.Image) -> dict:
        """Extract all available metadata from the image."""
        metadata = {}

        # Basic format info
        metadata["format_info"] = {
            "format": image.format or "Unknown",
            "mode": image.mode,
            "size": {"width": image.size[0], "height": image.size[1]},
        }

        # EXIF data
        exif_dict = {}
        try:
            exif_raw = None
            if hasattr(image, "_getexif"):
                exif_raw = image._getexif()
            if exif_raw:
                for tag_id, value in exif_raw.items():
                    tag_name = TAGS.get(tag_id, tag_id)
                    str_tag = str(tag_name)
                    try:
                        if str_tag == "GPSInfo" and isinstance(value, dict):
                            gps_data = {}
                            for gps_tag_id, gps_value in value.items():
                                gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                                gps_data[str(gps_tag)] = str(gps_value)
                            exif_dict["GPSInfo"] = str(gps_data)
                        elif isinstance(value, bytes):
                            exif_dict[str_tag] = f"<binary data {len(value)} bytes>"
                        elif isinstance(value, (tuple, list)):
                            exif_dict[str_tag] = str(value)[:200]
                        else:
                            exif_dict[str_tag] = str(value)[:200]
                    except Exception:
                        exif_dict[str_tag] = "<unparseable>"
        except Exception:
            pass

        metadata["exif"] = exif_dict

        # PNG text chunks
        png_text = {}
        try:
            if hasattr(image, "text") and image.text:
                for key, value in image.text.items():
                    png_text[str(key)] = str(value)[:500]
        except Exception:
            pass
        metadata["png_text"] = png_text

        # Image info dict
        info = {}
        try:
            for key, value in image.info.items():
                if key not in ("exif", "icc_profile"):
                    try:
                        info[str(key)] = str(value)[:200]
                    except Exception:
                        pass
        except Exception:
            pass
        metadata["image_info"] = info

        return metadata
