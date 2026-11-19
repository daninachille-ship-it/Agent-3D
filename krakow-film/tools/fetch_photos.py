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
    q = {'action': 'query', 'format': 'json', 'generator': 'search', 'gsrsearch': query + ' filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 15,
         'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'iiextmetadatafilter': 'LicenseShortName|Artist'}
    d = json.loads(get(API + '?' + urllib.parse.urlencode(q)))
    pages = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
    out = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        if ii.get('mime') != 'image/jpeg': continue
        w, h = ii.get('width', 0), ii.get('height', 0)
        if w < 1800 or w < h * 1.15: continue
        md = ii.get('extmetadata', {})
        lic = md.get('LicenseShortName', {}).get('value', '')
        if not OK_LIC.match(lic.strip().lower().replace(' ', '-')): continue
        artist = re.sub('<[^>]+>', '', md.get('Artist', {}).get('value', '')).strip()
        orig = ii.get('url', ''); name = orig.rsplit('/', 1)[-1]
        thumb = orig.replace('/wikipedia/commons/', '/wikipedia/commons/thumb/') + f'/1920px-{name}'
        out.append({'title': p['title'], 'thumb': thumb, 'page': ii.get('descriptionurl'), 'license': lic, 'author': artist, 'w': w, 'h': h})
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
                try: data = get(r['thumb'])
                except Exception as e: print('skip', fn, e, flush=True); continue
                open(path, 'wb').write(data)
                time.sleep(1.0)
            meta[fn] = r
        print(key, len(res), flush=True)
        time.sleep(6)
        json.dump(meta, open(meta_path, 'w'), indent=1, ensure_ascii=False)
