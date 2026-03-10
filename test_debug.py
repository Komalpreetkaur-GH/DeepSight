"""Test the updated API with AI-generated image."""
import io, requests
from PIL import Image

# Get an AI-generated face
print("Downloading AI-generated face from thispersondoesnotexist.com...")
r = requests.get("https://thispersondoesnotexist.com", timeout=15,
                  headers={"User-Agent": "Mozilla/5.0"})
print(f"Downloaded {len(r.content)} bytes")

# Send to our API
print("Sending to DeepSight API...")
resp = requests.post(
    "http://localhost:8000/api/analyze",
    files={"file": ("ai_face.jpg", io.BytesIO(r.content), "image/jpeg")},
    timeout=180,
)
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    cnn = data["analyzers"]["cnn"]
    print(f"\nCNN prediction: {cnn['prediction']}")
    print(f"CNN confidence: {cnn['confidence']}%")
    print(f"CNN score (AI prob): {cnn['score']}")
    print(f"CNN raw results: {cnn.get('raw_results')}")
    print(f"\nOverall verdict: {data['verdict']['label']} (score: {data['verdict']['score']})")
    for k in ("ela", "frequency", "noise", "metadata"):
        a = data["analyzers"].get(k, {})
        print(f"  {k}: score={a.get('score', '?')}")
else:
    print(f"Error: {resp.text[:500]}")
