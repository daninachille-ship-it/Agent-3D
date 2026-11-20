"""Pick the sharpest frame of given video segments and save it as a film plate (plus its line drawing).
Usage: python3 tools/frames_from_video.py video.mp4 out_dir key=start-end [key=start-end ...]
"""
import sys, os, subprocess, json
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from prep_photos import lines_of

def frame(video, t):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    from io import BytesIO
    return Image.open(BytesIO(raw)).convert('RGB')

def sharpness(img):
    g = np.asarray(img.convert('L'), dtype=np.float32)
    lap = g[1:-1, 1:-1] * 4 - g[:-2, 1:-1] - g[2:, 1:-1] - g[1:-1, :-2] - g[1:-1, 2:]
    return float(lap.var())

video, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
for arg in sys.argv[3:]:
    key, rng = arg.split('=')
    a, b = map(float, rng.split('-'))
    cands = [frame(video, a + (b - a) * f) for f in (0.25, 0.35, 0.45, 0.55, 0.65, 0.75)]
    best = max(cands, key=sharpness)
    h = 1536; img = best.resize((round(best.width * h / best.height), h), Image.LANCZOS)
    img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
    img.save(os.path.join(out, key + '.jpg'), quality=92)
    lines_of(img).save(os.path.join(out, key + '_lines.png'), optimize=True)
    print(key, img.size, flush=True)
