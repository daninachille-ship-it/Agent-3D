"""Search Wikimedia Commons for free-licence photos and download candidates with their credits.
Usage: python3 tools/fetch_photos.py <outdir> "<key>|<query>" ...
Writes <outdir>/<key>_<n>.jpg and <outdir>/candidates.json (title, author, licence, url).
"""
import json, sys, os, re, time, urllib.request, urllib.parse

UA = 'CityFilmPhotoFetcher/1.0 (educational film project)'
API = 'https://commons.wikimedia.org/w/api.php'
OK_LIC = re.compile(r'^(cc-by(-sa)?(-\d\.\d)?|cc0|pd|public domain|cc-zero|attribution)', re.I)

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r: return r.read()
        except Exception as e:
            wait = 60 * (attempt + 1) if '429' in str(e) else 5
            print('  retry', attempt, str(e)[:60], f'wait {wait}s', flush=True)
            time.sleep(wait)
    raise RuntimeError('failed ' + url)

def search(query, n=5):
    """Search via Openverse (CC-licensed images, no key); prefer Wikimedia-hosted files (1920 px thumbs)."""
    q = {'q': query, 'page_size': 20, 'license_type': 'commercial,modification', 'aspect_ratio': 'wide', 'size': 'large'}
    d = json.loads(get('https://api.openverse.org/v1/images/?' + urllib.parse.urlencode(q)))
    out = []
    for r in d.get('results', []):
        url = r.get('url', ''); w = r.get('width') or 0; h = r.get('height') or 1
        if w < 1600 or w < h * 1.15 or not url.lower().endswith(('.jpg', '.jpeg')): continue
        if 'upload.wikimedia.org/wikipedia/commons/' in url:
            name = url.rsplit('/', 1)[-1]
            thumb = url.replace('/wikipedia/commons/', '/wikipedia/commons/thumb/') + f'/1920px-{name}'
        elif 'staticflickr.com' in url: thumb = url
        else: continue
        lic = f"CC {r.get('license', '').upper()} {r.get('license_version') or ''}".strip()
        if r.get('license') in ('cc0', 'pdm'): lic = r['license'].upper()
        out.append({'title': r.get('title') or '', 'thumb': thumb, 'page': r.get('foreign_landing_url'), 'license': lic, 'author': r.get('creator') or '', 'w': w, 'h': h, 'source': r.get('source')})
        if len(out) >= n: break
    return out

if __name__ == '__main__':
    outdir = sys.argv[1]; os.makedirs(outdir, exist_ok=True)
    meta_path = os.path.join(outdir, 'candidates.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    for arg in sys.argv[2:]:
        key, query = arg.split('|', 1)
        res = search(query)
        for i, r in enumerate(res):
            fn = f'{key}_{i}.jpg'
            path = os.path.join(outdir, fn)
            if not os.path.exists(path):
                data = None
                for wpx in ('1920px-', '1280px-', '960px-'):
                    url = r['thumb'].replace('/1920px-', '/' + wpx)
                    try:
                        req = urllib.request.Request(url, headers={'User-Agent': UA})
                        with urllib.request.urlopen(req, timeout=60) as resp: data = resp.read(); break
                    except Exception as e:
                        time.sleep(4)
                if data is None: print('skip', fn, flush=True); continue
                open(path, 'wb').write(data)
                time.sleep(1.0)
            meta[fn] = r
        print(key, len(res), flush=True)
        time.sleep(6)
        json.dump(meta, open(meta_path, 'w'), indent=1, ensure_ascii=False)
