"""
CNN-Based Deepfake Classifier Module
======================================
Uses a pre-trained AI image detection model from HuggingFace to classify
images as Real or AI-Generated, with Grad-CAM visual explanations showing
which regions of the image influenced the decision.
"""

import io
import base64
import numpy as np
from PIL import Image
import cv2

import torch
import torch.nn.functional as F
from transformers import pipeline, AutoModelForImageClassification, AutoImageProcessor


class CNNClassifier:
    """
    AI-generated image detector using a pre-trained HuggingFace model.
    Includes Grad-CAM for visual explanation of the classification decision.
    """

    MODEL_NAME = "Ateeqq/ai-vs-human-image-detector"

    def __init__(self):
        self._model = None
        self._extractor = None
        self._pipeline = None
        self._device = "cuda" if torch.cuda.is_available() else "cpu"

    def _load_model(self):
        """Lazy-load the model on first use."""
        if self._pipeline is None:
            try:
                print(f"[CNN] Loading model '{self.MODEL_NAME}' on {self._device}...")
                # Check if timm is available (often needed for SigLip)
                try:
                    import timm
                    print(f"[CNN] timm version: {timm.__version__}")
                except ImportError:
                    print("[CNN] WARNING: timm not found. Vision models might fail.")

                self._model = AutoModelForImageClassification.from_pretrained(
                    self.MODEL_NAME,
                    trust_remote_code=True
                )
                self._extractor = AutoImageProcessor.from_pretrained(self.MODEL_NAME)
                self._model.to(self._device)
                self._model.eval()

                self._pipeline = pipeline(
                    "image-classification",
                    model=self._model,
                    image_processor=self._extractor,
                    device=0 if self._device == "cuda" else -1,
                )
                print("[CNN] Model loaded successfully.")
            except Exception as e:
                print(f"[CNN] CRITICAL: Model loading failed: {e}")
                import traceback
                traceback.print_exc()
                raise e

    def analyze(self, image: Image.Image) -> dict:
        """
        Classify an image as Real or AI-Generated.

        Returns:
            dict with keys:
                - score (float 0-1): AI-generated probability
                - prediction (str): "Real" or "AI-Generated"
                - confidence (float): confidence percentage
                - gradcam_b64 (str): base64 Grad-CAM heatmap overlay
                - description (str): interpretation
        """
        self._load_model()

        # Ensure RGB
        if image.mode != "RGB":
            image = image.convert("RGB")

        # Run classification
        results = self._pipeline(image)

        # Parse results — model outputs "artificial" and "real" labels
        ai_score = 0.5
        for r in results:
            label = r["label"].lower().strip()
            if label in ("artificial", "ai", "fake", "ai-generated", "computer"):
                ai_score = r["score"]
                break
            elif label in ("human", "real", "authentic", "nature"):
                ai_score = 1.0 - r["score"]
                break

        print(f"[CNN] Raw results: {results}")
        print(f"[CNN] AI score: {ai_score}")

        # Determine prediction
        if ai_score > 0.7:
            prediction = "AI-Generated"
            confidence = ai_score
        elif ai_score < 0.3:
            prediction = "Real"
            confidence = 1.0 - ai_score
        else:
            prediction = "Uncertain"
            confidence = max(ai_score, 1.0 - ai_score)

        # Generate Grad-CAM visualization
        gradcam_b64 = self._generate_gradcam(image)

        # Interpretation
        if prediction == "Real":
            description = f"The CNN classifier is {confidence*100:.1f}% confident this is a real photograph. The neural network did not detect patterns typical of AI-generated content."
        elif prediction == "AI-Generated":
            description = f"The CNN classifier is {confidence*100:.1f}% confident this image is AI-generated. The Grad-CAM heatmap highlights regions that triggered the detection."
        else:
            description = f"The CNN classifier is uncertain (confidence: {confidence*100:.1f}%). The image has characteristics of both real and AI-generated content."

        return {
            "score": round(ai_score, 3),
            "prediction": prediction,
            "confidence": round(confidence * 100, 1),
            "gradcam_b64": gradcam_b64,
            "raw_results": [{"label": r["label"], "score": round(r["score"], 4)} for r in results],
            "description": description,
        }

    def _generate_gradcam(self, image: Image.Image) -> str:
        """
        Generate Grad-CAM heatmap showing which regions influenced the decision.
        """
        try:
            # Preprocess image
            inputs = self._extractor(images=image, return_tensors="pt")
            pixel_values = inputs["pixel_values"].to(self._device)

            # Hook into the last convolutional layer
            activations = []
            gradients = []

            # Find the last conv layer
            target_layer = None
            for name, module in self._model.named_modules():
                if isinstance(module, torch.nn.Conv2d):
                    target_layer = module

            if target_layer is None:
                # Fallback: return empty
                return self._generate_fallback_heatmap(image)

            def forward_hook(module, input, output):
                activations.append(output.detach())

            def backward_hook(module, grad_input, grad_output):
                gradients.append(grad_output[0].detach())

            handle_fwd = target_layer.register_forward_hook(forward_hook)
            handle_bwd = target_layer.register_full_backward_hook(backward_hook)

            # Forward pass
            outputs = self._model(pixel_values)
            logits = outputs.logits

            # Backward pass on predicted class
            pred_class = logits.argmax(dim=1)
            self._model.zero_grad()
            logits[0, pred_class].backward()

            # Compute Grad-CAM
            if activations and gradients:
                act = activations[0]
                grad = gradients[0]

                # Global average pooling of gradients
                weights = torch.mean(grad, dim=(2, 3), keepdim=True)
                cam = torch.sum(weights * act, dim=1).squeeze()
                cam = F.relu(cam)

                # Normalize
                cam = cam - cam.min()
                if cam.max() > 0:
                    cam = cam / cam.max()

                cam_np = cam.cpu().numpy()

                # Resize to image size
                cam_resized = cv2.resize(cam_np, image.size)

                # Create heatmap overlay
                heatmap = cv2.applyColorMap(
                    np.uint8(cam_resized * 255), cv2.COLORMAP_JET
                )
                heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)

                # Blend with original
                img_array = np.array(image)
                overlay = cv2.addWeighted(img_array, 0.6, heatmap_rgb, 0.4, 0)
                result = Image.fromarray(overlay)
            else:
                result = self._generate_fallback_image(image)

            # Cleanup
            handle_fwd.remove()
            handle_bwd.remove()

            return self._image_to_base64(result)

        except Exception as e:
            print(f"[CNN] Grad-CAM generation failed: {e}")
            return self._generate_fallback_heatmap(image)

    def _generate_fallback_image(self, image: Image.Image) -> Image.Image:
        """Generate a simple overlay when Grad-CAM fails."""
        img_array = np.array(image)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        heatmap = cv2.applyColorMap(gray, cv2.COLORMAP_JET)
        heatmap_rgb = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
        overlay = cv2.addWeighted(img_array, 0.7, heatmap_rgb, 0.3, 0)
        return Image.fromarray(overlay)

    def _generate_fallback_heatmap(self, image: Image.Image) -> str:
        """Return a base64 fallback heatmap string."""
        result = self._generate_fallback_image(image)
        return self._image_to_base64(result)

    @staticmethod
    def _image_to_base64(image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, "PNG")
        return base64.b64encode(buffer.getvalue()).decode("utf-8")
