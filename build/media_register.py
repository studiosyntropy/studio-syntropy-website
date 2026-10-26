#!/usr/bin/env python3
"""Media register: every photo, graphic and video file of the website, where it is used and where its original lives.

Reads the built pages (run build.py first) and content/media-origins.json.
Writes media-register.json (one record per file). Claude syncs it to the "Media register" artifact.
Run:  python3 build/media_register.py
"""
import glob, json, os, re, datetime, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://studio-syntropy.com'
SECTIONS = {'top': 'Top photo', 'services': 'Services', 'approach': 'Approach', 'story': 'Story "From rock to food forest"',
            'projects': 'Projects', 'research': 'Research', 'teaching': 'Teaching', 'about': 'About', 'blog': 'Blog list', 'contact': 'Contact'}
PAGES = {'index.html': ('Home (English)', SITE + '/'), 'zh/index.html': ('Home (Chinese)', SITE + '/zh'), 'blog/index.html': ('Blog overview', SITE + '/blog')}

def page_info(rel, html):
    if rel in PAGES: return PAGES[rel] + (None,)
    m = re.search(r'<h1 id="post-title">(.*?)</h1>', html)
    d = re.search(r'<time datetime="([\d-]+)"', html)
    slug = rel.split('/')[1]
    return ('Blog post "%s"' % re.sub('<[^>]+>', '', m.group(1)).replace('&amp;', '&'), '%s/blog/%s' % (SITE, slug), d.group(1) if d else None)

def git_added(path):
    try:
        out = subprocess.run(['git', 'log', '--diff-filter=A', '--follow', '--format=%as', '--', path], cwd=ROOT, capture_output=True, text=True).stdout.split()
        return out[-1] if out else None
    except Exception:
        return None

def main():
    origins = json.load(open(os.path.join(ROOT, 'content/media-origins.json'), encoding='utf-8'))
    files = sorted(f for f in glob.glob('img/**/*.*', root_dir=ROOT, recursive=True))
    uses = {f: [] for f in files}
    for rel in ['index.html', 'zh/index.html', 'blog/index.html'] + sorted(glob.glob('blog/*/index.html', root_dir=ROOT)):
        html = open(os.path.join(ROOT, rel), encoding='utf-8').read()
        page, url, pdate = page_info(rel, html)
        main = html[html.index('<main'):html.index('</main>')]
        # section boundaries on home pages
        bounds = [(m.start(), m.group(1)) for m in re.finditer(r'<(?:section|div)[^>]*\bid="(%s)"' % '|'.join(SECTIONS), html)]
        for m in re.finditer(r'<img\b[^>]*>', html):
            tag = m.group(0)
            src = re.search(r'src="([^"]+)"', tag).group(1)
            f = re.sub(r'^(\.\./)+', '', src)
            if f not in uses: continue
            alt = (re.search(r'alt="([^"]*)"', tag) or [None, ''])[1]
            if 'class="hero-bg"' in tag: where = 'Top photo'
            elif 'logo-dark' in tag and m.start() < html.index('<main'): where = 'Header (logo, dark mode)'
            elif m.start() < html.index('<main'): where = 'Header (logo)'
            elif m.start() > html.index('</main>') or ('<footer' in html and m.start() > html.index('<footer')): where = 'Footer (logo)'
            elif rel in PAGES and rel != 'blog/index.html':
                sec = [b for b in bounds if b[0] < m.start()]
                where = SECTIONS[sec[-1][1]] if sec else 'Page'
            elif 'class="cover"' in tag: where = 'Cover photo'
            elif 'class="bl"' in html[max(0, m.start() - 120):m.start()]: where = 'Post list thumbnail'
            else: where = 'In the text'
            caption = ''
            after = html[m.end():m.end() + 900]
            c = re.match(r'\s*(?:</figure>)?\s*<figcaption[^>]*>(.*?)</figcaption>', after, re.S) or re.search(r'^[\s\S]{0,700}?<p class="media-cap"[^>]*>(.*?)</p>', after)
            if c: caption = re.sub(r'<[^>]+>', '', c.group(1)).strip()
            if where == 'Post list thumbnail' or where.startswith('Header') or where.startswith('Footer'): caption = ''
            uses[f].append({'page': page, 'url': url, 'section': where, 'page_date': pdate, 'alt': alt.replace('&amp;', '&'), 'caption': caption})
        for m in re.finditer(r'<link rel="(icon|apple-touch-icon)"[^>]*href="(?:\.\./)*(img/[^"]+)"', html):
            if m.group(2) in uses: uses[m.group(2)].append({'page': page, 'url': url, 'section': 'Browser tab icon' if m.group(1) == 'icon' else 'Phone home-screen icon', 'page_date': pdate, 'alt': '', 'caption': ''})
        for m in re.finditer(r'<meta property="og:image" content="%s/([^"]+)"' % re.escape(SITE), html):
            if m.group(1) in uses: uses[m.group(1)].append({'page': page, 'url': url, 'section': 'Share preview image', 'page_date': pdate, 'alt': '', 'caption': ''})
    held = open(os.path.join(ROOT, '_held/held-content.html'), encoding='utf-8').read() if os.path.exists(os.path.join(ROOT, '_held/held-content.html')) else ''
    out = []
    for f in files:
        p = os.path.join(ROOT, f)
        kind = 'Logo' if '/v8-' in f else ('Slide or chart' if re.search(r'blog-res-[2-7]|blog-guf-1|kira-design', f) else 'Photo')
        try:
            im = Image.open(p); w, h = im.size
        except Exception:
            m = re.search(r'viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"', open(p, encoding='utf-8', errors='ignore').read()); w, h = (round(float(m.group(1))), round(float(m.group(2)))) if m else (None, None)
        o = origins.get(f, {})
        u = uses[f]
        # one entry per page and section (English and Chinese home pages show the same photo)
        seen, merged = {}, []
        for x in u:
            key = (x['section'], x['page'].replace(' (Chinese)', '').replace(' (English)', ''))
            if key in seen:
                seen[key]['page'] = seen[key]['page'].replace(' (English)', ' (English and Chinese)'); continue
            seen[key] = dict(x); merged.append(seen[key])
        status = 'In use' if merged else ('Held back' if os.path.basename(f) in held else 'Not used')
        alt = next((x['alt'] for x in u if x['alt']), '')
        out.append({'id': f.replace('/', '__').replace('.', '_'), 'file': os.path.basename(f), 'web_path': f, 'kind': kind,
                    'status': status, 'description': alt, 'width': w, 'height': h, 'size_kb': round(os.path.getsize(p) / 1024),
                    'taken': o.get('taken'), 'original': o.get('original'), 'copy': o.get('copy'), 'embedded_in': o.get('embedded'),
                    'source': o.get('source'), 'edit': o.get('edit'), 'credit': o.get('credit'), 'note': o.get('note'),
                    'added_to_site': git_added(f), 'uses': merged})
    json.dump({'updated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), 'videos': 0, 'items': out},
              open(os.path.join(ROOT, 'media-register.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(len(out), 'files;', sum(1 for x in out if x['status'] == 'In use'), 'in use')

if __name__ == '__main__':
    main()
