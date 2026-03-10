"""Quick API test for DeepSight."""
import io
import requests
from PIL import Image

img = Image.new("RGB", (256, 256))
for x in range(256):
    for y in range(256):
        img.putpixel((x, y), (x, y, (x + y) % 256))

buf = io.BytesIO()
img.save(buf, "JPEG", quality=85)
buf.seek(0)

print("Sending test image to API...")
resp = requests.post(
    "http://localhost:8000/api/analyze",
    files={"file": ("test.jpg", buf, "image/jpeg")},
    timeout=180,
)
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    v = data.get("verdict", {})
    print(f"Verdict: {v.get('label')} (score: {v.get('score')})")
    print(f"Time: {data.get('total_time_ms')}ms")
    for k in ("cnn", "ela", "frequency", "noise", "metadata"):
        a = data.get("analyzers", {}).get(k, {})
        print(f"  {k}: score={a.get('score', '?')} {'ERROR' if a.get('error') else 'OK'}")
else:
    print(f"Error response: {resp.text[:1000]}")
