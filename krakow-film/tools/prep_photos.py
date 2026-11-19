"""Prepare film plates: resize each chosen photo and extract a clean 'architect drawing' line layer.
Usage: python3 tools/prep_photos.py <candidates_dir> <out_dir> key=file.jpg [key=file.jpg ...]
Writes <out_dir>/<key>.jpg, <out_dir>/<key>_lines.png and merges credits into <out_dir>/credits.json
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageFilter

def blur(a, s):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(s)), dtype=np.float32) / 255

def lines_of(img):
    g = np.asarray(img.convert('L'), dtype=np.float32) / 255
    # local contrast normalisation so dark & bright areas both yield lines
    m = blur(g, 25); v = np.sqrt(blur((g - m) ** 2, 25)) + 0.04
    n = np.clip((g - m) / v * 0.18 + 0.5, 0, 1)
    # difference of gaussians (sketch lines) + gradient magnitude (structure)
    d = blur(n, 1.0) - blur(n, 2.2)
    dog = np.clip(-d * 9.0, 0, 1)
    b = blur(n, 1.2)
    gx = np.zeros_like(b); gy = np.zeros_like(b)
    gx[:, 1:-1] = b[:, 2:] - b[:, :-2]; gy[1:-1] = b[2:] - b[:-2]
    mag = np.sqrt(gx ** 2 + gy ** 2)
    mag = np.clip(mag / (np.percentile(mag, 97) + 1e-6), 0, 1) ** 1.4
    L = np.clip(np.maximum(dog * 0.9, mag * 0.85), 0, 1)
    L = np.where(L > 0.12, L, 0) ** 0.8
    return Image.fromarray((L * 255).astype(np.uint8))

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    cand = json.load(open(os.path.join(src, 'candidates.json')))
    cpath = os.path.join(out, 'credits.json')
    credits = json.load(open(cpath)) if os.path.exists(cpath) else {}
    for arg in sys.argv[3:]:
        key, fn = arg.split('=')
        img = Image.open(os.path.join(src, fn)).convert('RGB')
        if img.width != 1920: img = img.resize((1920, round(img.height * 1920 / img.width)), Image.LANCZOS)
        img.save(os.path.join(out, key + '.jpg'), quality=90)
        lines_of(img).save(os.path.join(out, key + '_lines.png'), optimize=True)
        c = cand[fn]; credits[key] = {'title': c['title'], 'author': c['author'], 'license': c['license'], 'page': c['page']}
        print(key, img.size, flush=True)
    json.dump(credits, open(cpath, 'w'), indent=1, ensure_ascii=False)
