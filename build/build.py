#!/usr/bin/env python3
"""Build the static Studio Syntropy site.

Source:  src/index.html        bilingual page (English and Chinese in <span lang> pairs)
         content/blog/*.md     blog posts (front matter + simple Markdown)
Output:  index.html            English home      -> https://studio-syntropy.com/
         zh/index.html         Chinese home      -> https://studio-syntropy.com/zh
         blog/index.html       list of all posts -> https://studio-syntropy.com/blog
         blog/<slug>/index.html one page per post
         sitemap.xml, robots.txt

Set LAUNCH = True at launch: removes "noindex" and opens robots.txt.
Run:  python3 build/build.py
"""
import html, json, os, re, glob, datetime

LAUNCH = False
SITE = 'https://studio-syntropy.com'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OTHER = {'en': 'zh-Hant', 'zh-Hant': 'en'}

# ---------------------------------------------------------------- helpers
def strip_lang(s, drop):
    """Remove every element carrying lang=<drop> unless it has class keep."""
    out, i = [], 0
    open_re = re.compile(r'<([a-zA-Z][\w-]*)\b([^>]*)\blang="%s"([^>]*)>' % re.escape(drop))
    while True:
        m = open_re.search(s, i)
        if not m:
            out.append(s[i:]); break
        tag, attrs = m.group(1), m.group(2) + m.group(3)
        if re.search(r'class="[^"]*\bkeep\b', attrs):
            out.append(s[i:m.end()]); i = m.end(); continue
        out.append(s[i:m.start()])
        depth, j = 1, m.end()
        tok = re.compile(r'<(/?)%s\b[^>]*>' % tag)
        while depth:
            t = tok.search(s, j)
            if not t: raise ValueError('unbalanced <%s> near %d' % (tag, m.start()))
            depth += -1 if t.group(1) else 1
            j = t.end()
        i = j
    return ''.join(out)

def esc(t): return html.escape(t, quote=True)

def inline(t):
    parts, last = [], 0
    for m in re.finditer(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', t):
        parts.append(esc(t[last:m.start()]))
        parts.append('<a href="%s" target="_blank" rel="noopener">%s<span class="sr-only"> (opens in a new tab)</span></a>' % (esc(m.group(2)), esc(m.group(1))))
        last = m.end()
    parts.append(esc(t[last:]))
    return ''.join(parts)

IMG = re.compile(r'^!\[([^|\]]*)\|?([^\]]*)\]\(([^)\s]+)\)$')
BA = re.compile(r'^!ba\[([^|\]]*)\|([^|\]]*)\|([^\]]*)\]\((\S+) (\S+)\)$')
ba_count = [0]

def slider(alt_b, alt_a, cap, src_b, src_a, pre, lab=('Before', 'After')):
    ba_count[0] += 1
    return ('<figure class="ba" style="--ar:16/9"><img class="before" src="{p}{sb}" alt="{ab}" loading="lazy"><img class="after" src="{p}{sa}" alt="{aa}" loading="lazy">'
            '<span class="divider" aria-hidden="true"></span><span class="knob" aria-hidden="true">⇆</span>'
            '<span class="lbl b" aria-hidden="true">{lb}</span><span class="lbl a" aria-hidden="true">{la}</span>'
            '<input type="range" min="0" max="100" value="50" id="ba-post-{n}" aria-label="Before and after comparison"></figure>'
            '<p class="media-cap">{c}</p>').format(p=pre, sb=esc(src_b), sa=esc(src_a), ab=esc(alt_b), aa=esc(alt_a), lb=lab[0], la=lab[1], n=ba_count[0], c=esc(cap))

def markdown(body, pre):
    out = []
    for block in re.split(r'\n{2,}', body.strip()):
        lines = [l.strip() for l in block.strip().split('\n') if l.strip()]
        if not lines: continue
        if lines[0].startswith('## '):
            out.append('<h2>%s</h2>' % inline(lines[0][3:])); continue
        if len(lines) == 1 and BA.match(lines[0]):
            out.append(slider(*BA.match(lines[0]).groups(), pre)); continue
        if all(IMG.match(l) for l in lines):
            figs = []
            for l in lines:
                alt, cap, src = IMG.match(l).groups()
                figs.append('<figure><img src="%s%s" alt="%s" loading="lazy">%s</figure>' % (pre, esc(src), esc(alt), '<figcaption class="media-cap">%s</figcaption>' % esc(cap) if cap else ''))
            out.append('<div class="%s">%s</div>' % ('post-pair' if len(figs) > 1 else 'post-figs', ''.join(figs))); continue
        if all(re.match(r'^[-•] ', l) for l in lines):
            out.append('<ul>%s</ul>' % ''.join('<li>%s</li>' % inline(l[2:]) for l in lines)); continue
        out.append('<p>%s</p>' % '<br>'.join(inline(l) for l in lines))
    return '\n'.join(out)

def read_posts():
    posts = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'content/blog/*.md'))):
        raw = open(f, encoding='utf-8').read()
        m = re.match(r'---\n(.*?)\n---\n(.*)', raw, re.S)
        meta = dict(re.findall(r'^(\w+):\s*(.*)$', m.group(1), re.M))
        meta['body'] = m.group(2)
        plain = re.sub(r'^!.*$|^## .*$', '', meta['body'], flags=re.M)
        plain = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', plain)
        meta['excerpt'] = re.sub(r'\s+', ' ', plain).strip()
        posts.append(meta)
    return sorted(posts, key=lambda p: p['date'], reverse=True)

def fmt_date(d, lang):
    y, m, dd = map(int, d.split('-'))
    if lang == 'zh-Hant': return '%d 年 %d 月 %d 日' % (y, m, dd)
    return datetime.date(y, m, dd).strftime('%-d %B %Y')

def short(t, n=150): return t if len(t) <= n else t[:t.rfind(' ', 0, n)] + '…'

# ---------------------------------------------------------------- page assembly
HEAD_SEO = {
 'en': dict(title='Studio Syntropy | Syntropic agroforestry design, courses and consultancy in Taiwan',
            desc='Studio Syntropy (趨合工作室) designs syntropic agroforestry systems and food forests in Hualien, Taiwan and beyond: design consultancy, courses, soil assessment and biomass management.'),
 'zh-Hant': dict(title='趨合工作室 Studio Syntropy｜趨合農業與食物森林設計、課程及顧問（花蓮・台灣）',
            desc='趨合工作室在花蓮及台灣各地設計趨合農業系統與食物森林，提供設計顧問、課程與工作坊、土壤評估及生物量管理服務。'),
}

ORG = {
 '@type': 'ProfessionalService', '@id': SITE + '/#studio',
 'name': 'Studio Syntropy', 'alternateName': '趨合工作室', 'url': SITE + '/',
 'logo': SITE + '/img/v8-app-icon.png', 'image': SITE + '/img/hero-chili-gft.jpg',
 'description': HEAD_SEO['en']['desc'],
 'email': 'studiosyntropy@proton.me', 'telephone': '+886909572694',
 'address': {'@type': 'PostalAddress', 'addressLocality': 'Hualien', 'addressCountry': 'TW'},
 'areaServed': ['Taiwan', 'Malaysia'],
 'knowsAbout': ['Syntropic agroforestry', 'Food forest design', 'Soil health', 'Soil food web', 'Agroforestry courses'],
 'founder': {'@type': 'Person', '@id': SITE + '/#tobias', 'name': 'Tobias Chen', 'alternateName': '陳拓彼', 'jobTitle': 'Founder, syntropic agroforestry designer'},
}

def page_head(src_head, lang, title, desc, canonical, alternates, og_image, og_type, jsonld, prefix):
    h = src_head
    h = re.sub(r'<title>.*?</title>', '<title>%s</title>' % esc(title), h, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(desc), h, count=1)
    h = h.replace('<meta name="claude:viewport-fit-sides" content="cover">\n', '')
    h = h.replace('href="favicon.ico"', 'href="%sfavicon.ico"' % prefix).replace('href="img/', 'href="%simg/' % prefix)
    extra = ['<link rel="canonical" href="%s">' % canonical]
    for hl, url in alternates: extra.append('<link rel="alternate" hreflang="%s" href="%s">' % (hl, url))
    extra += ['<meta property="og:type" content="%s">' % og_type, '<meta property="og:site_name" content="Studio Syntropy 趨合工作室">',
              '<meta property="og:title" content="%s">' % esc(title), '<meta property="og:description" content="%s">' % esc(desc),
              '<meta property="og:url" content="%s">' % canonical, '<meta property="og:image" content="%s">' % og_image,
              '<meta property="og:locale" content="%s">' % ('zh_TW' if lang == 'zh-Hant' else 'en_US'),
              '<meta name="twitter:card" content="summary_large_image">',
              '<script type="application/ld+json">%s</script>' % json.dumps(jsonld, ensure_ascii=False).replace('</', '<\\/')]
    robots = '' if LAUNCH else '<meta name="robots" content="noindex, nofollow">\n'
    return ('<!doctype html>\n<html lang="%s">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n%s%s\n%s'
            '<style>body{margin:0}[hidden]{display:none!important}</style>\n</head>\n<body>\n') % (lang, robots, '\n'.join(extra), h)

def fix_paths(body, prefix, home):
    """Rewrite asset paths for pages in sub-folders and point in-page anchors at the home page."""
    if prefix:
        body = re.sub(r'(src|href)="img/', r'\1="%simg/' % prefix, body)
        body = body.replace('href="blog/index.html"', 'href="%sblog/index.html"' % prefix)
    if home:
        body = re.sub(r'href="#(?!main|top\b)([\w-]+)"', r'href="%s#\1"' % home, body)
    return body

def build():
    src = open(os.path.join(ROOT, 'src/index.html'), encoding='utf-8').read()
    i = src.index('<a class="skip"')
    head, body = src[:i], src[i:]
    # pages kept out of the home page flow: <!--PAGE:name--> ... <!--/PAGE-->
    pages = {}
    for m in list(re.finditer(r'<!--PAGE:(\w+)-->\n(.*?)\n<!--/PAGE-->\n*', body, re.S)):
        pages[m.group(1)] = m.group(2)
    body = re.sub(r'<!--PAGE:(\w+)-->\n.*?\n<!--/PAGE-->\n*', '', body, flags=re.S)
    posts = read_posts()
    latest = posts[0]
    written = []

    def write(rel, text):
        path = os.path.join(ROOT, rel); os.makedirs(os.path.dirname(path), exist_ok=True)
        open(path, 'w', encoding='utf-8').write(text); written.append(rel)

    def link_pages(b, lang, prefix):
        root = prefix + ('zh/' if lang == 'zh-Hant' else '')
        return (b.replace('href="#research"', 'href="%sresearch/index.html"' % root)
                 .replace('href="#teaching"', 'href="%steaching/index.html"' % root)
                 .replace('href="#guidebook"', 'href="%steaching/index.html#guidebook"' % root))

    def lang_body(lang, prefix, href_en, href_zh, home=None, src_body=None):
        b = strip_lang(src_body if src_body is not None else body, OTHER[lang])
        b = link_pages(b, lang, prefix)
        b = b.replace('{{HREF_EN}}', href_en).replace('{{HREF_ZH}}', href_zh)
        b = b.replace('{{CUR_EN}}', 'aria-current="page"' if lang == 'en' else '').replace('{{CUR_ZH}}', 'aria-current="page"' if lang == 'zh-Hant' else '')
        return fix_paths(b, prefix, home)

    def blog_list(lang, prefix):
        items = []
        for p in posts[:3]:
            items.append('<li><a class="bl" href="%sblog/%s/index.html"><img src="%s%s" alt="" loading="lazy" width="320" height="240"><span><time datetime="%s">%s</time><span class="bl-t keep" lang="en">%s</span><span class="bl-x keep" lang="en">%s</span></span></a></li>'
                         % (prefix, p['slug'], prefix, p['cover'], p['date'], fmt_date(p['date'], lang), esc(p['title']), esc(short(p['excerpt']))))
        return '<ul class="blog-list">%s</ul>' % ''.join(items)

    def latest_line(lang, prefix):
        lab = '最新文章' if lang == 'zh-Hant' else 'Latest'
        return '<p class="hero-latest"><b>%s</b> <a href="%sblog/%s/index.html" lang="en" class="keep">%s <span aria-hidden="true">→</span></a></p>' % (lab, prefix, latest['slug'], esc(latest['title']))

    alt_home = [('en', SITE + '/'), ('zh-Hant', SITE + '/zh'), ('x-default', SITE + '/')]
    # ---- home pages
    for lang, rel, prefix, canon in [('en', 'index.html', '', SITE + '/'), ('zh-Hant', 'zh/index.html', '../', SITE + '/zh')]:
        seo = HEAD_SEO[lang]
        org = dict(ORG, **{'@context': 'https://schema.org'})
        if lang == 'zh-Hant': org['description'] = seo['desc']
        b = lang_body(lang, prefix, prefix + 'index.html' if prefix else 'index.html', 'index.html' if prefix else 'zh/index.html')
        b = b.replace('<!--BLOG_LIST-->', blog_list(lang, prefix)).replace('<!--LATEST-->', latest_line(lang, prefix))
        write(rel, page_head(head, lang, seo['title'], seo['desc'], canon, alt_home, SITE + '/img/hero-chili-gft.jpg', 'website', org, prefix) + b + '\n</body>\n</html>\n')

    # ---- shell for sub-pages: English home body with <main> replaced
    def shell(prefix, main_html, lang='en', href_en=None, href_zh=None):
        home = prefix + ('zh/' if lang == 'zh-Hant' else '') + 'index.html'
        b = lang_body(lang, prefix, href_en or prefix + 'index.html', href_zh or prefix + 'zh/index.html', home=home)
        a = b.index('<main id="main" tabindex="-1">') + len('<main id="main" tabindex="-1">'); z = b.index('</main>')
        return b[:a] + '\n' + main_html + '\n' + b[z:]

    # ---- post pages
    for idx, p in enumerate(posts):
        pre = '../../'
        url = '%s/blog/%s' % (SITE, p['slug'])
        others = [q for q in posts if q is not p][:2]
        more = ''.join('<li><a class="bl" href="../%s/index.html"><img src="%s%s" alt="" loading="lazy" width="320" height="240"><span><time datetime="%s">%s</time><span class="bl-t">%s</span></span></a></li>' % (q['slug'], pre, q['cover'], q['date'], fmt_date(q['date'], 'en'), esc(q['title'])) for q in others)
        main = ('<article class="post-page" aria-labelledby="post-title"><div class="wrap">'
                '<nav class="crumbs" aria-label="Breadcrumb"><a href="%sindex.html">Home</a> / <a href="../index.html">Blog</a></nav>'
                '<time datetime="%s">%s</time><h1 id="post-title">%s</h1>'
                '<img class="cover" src="%s%s" alt="%s" fetchpriority="high">'
                '<div class="post-body">%s</div>'
                '<div class="post-end"><a class="btn ghost" href="../index.html">← All posts</a><a class="btn" href="%sindex.html#contact">Contact the studio</a></div>'
                '<h2 class="sr-only" id="more-h">More posts</h2><ul class="blog-list" aria-labelledby="more-h" style="margin-top:2rem">%s</ul>'
                '</div></article>') % (pre, p['date'], fmt_date(p['date'], 'en'), esc(p['title']), pre, p['cover'], esc(p['cover_alt']), markdown(p['body'], pre), pre, more)
        ld = {'@context': 'https://schema.org', '@type': 'BlogPosting', 'headline': p['title'], 'description': p['description'],
              'datePublished': p['date'], 'image': SITE + '/' + p['cover'], 'url': url, 'inLanguage': 'en',
              'author': {'@type': 'Person', '@id': SITE + '/#tobias', 'name': 'Tobias Chen'}, 'publisher': {'@id': SITE + '/#studio', '@type': 'Organization', 'name': 'Studio Syntropy', 'logo': {'@type': 'ImageObject', 'url': SITE + '/img/v8-app-icon.png'}},
              'mainEntityOfPage': url}
        title = '%s | Studio Syntropy' % p['title']
        write('blog/%s/index.html' % p['slug'], page_head(head, 'en', title, p['description'], url, [('en', url)], SITE + '/' + p['cover'], 'article', ld, pre) + shell(pre, main) + '\n</body>\n</html>\n')

    # ---- blog index
    pre = '../'
    items = ''.join('<li><a class="bl" href="%s/index.html"><img src="%s%s" alt="" loading="lazy" width="320" height="240"><span><time datetime="%s">%s</time><span class="bl-t">%s</span><span class="bl-x">%s</span></span></a></li>' % (p['slug'], pre, p['cover'], p['date'], fmt_date(p['date'], 'en'), esc(p['title']), esc(short(p['excerpt'], 200))) for p in posts)
    main = ('<section class="post-page" aria-labelledby="blog-h"><div class="wrap">'
            '<nav class="crumbs" aria-label="Breadcrumb"><a href="../index.html">Home</a></nav>'
            '<p class="eyebrow">Blog</p><h1 id="blog-h">Notes from the field</h1>'
            '<p class="muted" style="margin-bottom:2rem">Projects, soil results and what grows at the sites of Studio Syntropy. Posts are in English.</p>'
            '<ul class="blog-list">%s</ul></div></section>') % items
    ld = {'@context': 'https://schema.org', '@type': 'Blog', 'name': 'Studio Syntropy Blog', 'url': SITE + '/blog', 'publisher': {'@id': SITE + '/#studio'},
          'blogPost': [{'@type': 'BlogPosting', 'headline': p['title'], 'url': '%s/blog/%s' % (SITE, p['slug']), 'datePublished': p['date']} for p in posts]}
    write('blog/index.html', page_head(head, 'en', 'Blog: notes from the field | Studio Syntropy', 'Field notes from Studio Syntropy: syntropic agroforestry projects, soil research and food forests in Hualien, Taiwan and beyond.', SITE + '/blog', [('en', SITE + '/blog')], SITE + '/img/hero-chili-gft.jpg', 'website', ld, pre) + shell(pre, main) + '\n</body>\n</html>\n')

    # ---- research and teaching pages
    PAGE_SEO = {
     'research': {'en': ('Research: syntropic agroforestry field trials in Hualien | Studio Syntropy', 'Soil, harvest and biodiversity measured on the syntropic agroforestry sites of Studio Syntropy in Hualien, Taiwan, with universities and research institutes; publications and press.'),
                  'zh-Hant': ('場域研究：花蓮趨合農業田間試驗｜趨合工作室', '趨合工作室與大學及研究機構合作，在花蓮的趨合農業場域量測土壤、收成與生物多樣性；相關發表與媒體報導。')},
     'teaching': {'en': ('Courses and talks on syntropic agroforestry in Taiwan | Studio Syntropy', 'Syntropic agroforestry courses, workshops and talks by Studio Syntropy in Taiwan and Malaysia, and the guidebook Syntropic Agroforestry: A Visual Guide for Taiwan.'),
                  'zh-Hant': ('趨合農業課程與演講｜趨合工作室', '趨合工作室在台灣與馬來西亞開設的趨合農業課程、工作坊與演講，以及《趨合農業：台灣圖解指南》。')},
    }
    for name, block in pages.items():
        urls = {'en': '%s/%s' % (SITE, name), 'zh-Hant': '%s/zh/%s' % (SITE, name)}
        alts = [('en', urls['en']), ('zh-Hant', urls['zh-Hant']), ('x-default', urls['en'])]
        for lang, rel, pre, href_en, href_zh in [('en', '%s/index.html' % name, '../', 'index.html', '../zh/%s/index.html' % name),
                                                ('zh-Hant', 'zh/%s/index.html' % name, '../../', '../../%s/index.html' % name, 'index.html')]:
            blk = strip_lang(block, OTHER[lang])
            blk = re.sub(r'<h2 id="(\w+-title)"([^>]*)>(.*?)</h2>', r'<h1 id="\1"\2>\3</h1>', blk, count=1, flags=re.S)
            blk = fix_paths(link_pages(blk, lang, pre), pre, pre + ('zh/' if lang == 'zh-Hant' else '') + 'index.html')
            blk = blk.replace('<h3', '<h3 aria-level="2"').replace('<h4', '<h4 aria-level="3"')  # no h2 on these pages: keep the look, fix the outline
            main = '<div class="page-top">\n' + blk + '\n</div>'
            title, desc = PAGE_SEO[name][lang]
            ld = {'@context': 'https://schema.org', '@type': 'WebPage', 'name': title, 'url': urls[lang], 'inLanguage': lang, 'isPartOf': {'@id': SITE + '/#studio'}}
            out = shell(pre, main, lang, href_en, href_zh)
            selfh = 'href="%s%s/index.html"' % (pre + ('zh/' if lang == 'zh-Hant' else ''), name)
            out = out.replace('<li><a ' + selfh + '>', '<li><a ' + selfh + ' aria-current="page">')
            write(rel, page_head(head, lang, title, desc, urls[lang], alts, SITE + '/img/hero-chili-gft.jpg', 'website', ld, pre) + out + '\n</body>\n</html>\n')

    # ---- sitemap & robots
    today = datetime.date.today().isoformat()
    urls = [(SITE + '/', today), (SITE + '/zh', today), (SITE + '/research', today), (SITE + '/zh/research', today), (SITE + '/teaching', today), (SITE + '/zh/teaching', today), (SITE + '/blog', posts[0]['date'])] + [('%s/blog/%s' % (SITE, p['slug']), p['date']) for p in posts]
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % ''.join('  <url><loc>%s</loc><lastmod>%s</lastmod></url>\n' % u for u in urls))
    write('robots.txt', 'User-agent: *\n%s\nSitemap: %s/sitemap.xml\n' % ('Allow: /' if LAUNCH else 'Disallow: /', SITE))
    return written

if __name__ == '__main__':
    for w in build(): print('wrote', w)
