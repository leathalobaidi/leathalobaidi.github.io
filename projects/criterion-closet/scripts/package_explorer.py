#!/usr/bin/env python3
"""Package the current explorer as standalone HTML and a dataset ZIP."""
import hashlib
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent / 'explorer'
data = root / 'data'
html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="explorer.css">', '<style>' + (root / 'explorer.css').read_text() + '</style>')
html = html.replace('<script src="model.js" defer></script>', '').replace('<script src="explorer.js" defer></script>', '')
html = re.sub(r'^[ \t]+$', '', html, flags=re.M)
# The saved copy filters entirely from embedded data. Navigation still opens the site.
html = re.sub(r'<!-- Cloudflare Web Analytics -->.*?<!-- End Cloudflare Web Analytics -->', '', html, flags=re.S)
html = html.replace('href="data/', 'href="https://leathalobaidi.com/projects/criterion-closet/explorer/data/')
html = html.replace('href="../syllabus.html"', 'href="https://leathalobaidi.com/projects/criterion-closet/syllabus.html"')
html = html.replace('href="../discover/"', 'href="https://leathalobaidi.com/projects/criterion-closet/discover/"')
html = html.replace('href="../"', 'href="https://leathalobaidi.com/projects/criterion-closet/"')
html = html.replace('href="/"', 'href="https://leathalobaidi.com/"').replace('href="/favicon.svg"', 'href="https://leathalobaidi.com/favicon.svg"')
source_data = {p.stem: json.loads(p.read_text()) for p in sorted((data / 'sources').glob('*.json'))}
embedded = '<script id="embedded-data" type="application/json">' + (data / 'explorer-data.json').read_text().replace('<', '\\u003c') + '</script>'
embedded += '<script id="embedded-sources" type="application/json">' + json.dumps(source_data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + '</script>'
embedded += '<script>' + (root / 'model.js').read_text() + '</script><script>' + (root / 'explorer.js').read_text() + '</script>'
html = html.replace('</body>', embedded + '\n</body>')
(data / 'criterion-explorer.html').write_text(html)
files = [p for p in sorted(data.rglob('*')) if p.is_file() and p.name not in ('checksums.json', 'criterion-public-dataset.zip')]
checksums = {str(p.relative_to(data)): dict(bytes=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files}
(data / 'checksums.json').write_text(json.dumps(checksums, indent=2) + '\n')
with zipfile.ZipFile(data / 'criterion-public-dataset.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for p in files + [data / 'checksums.json']:
        archive.write(p, 'criterion-dataset/' + str(p.relative_to(data)))
    for p in (root.parent / 'scripts').glob('*'):
        if p.is_file() and p.suffix in ('.py', '.cjs', '.json'):
            archive.write(p, 'criterion-dataset/scripts/' + p.name)
with zipfile.ZipFile(data / 'criterion-public-dataset.zip') as archive:
    assert archive.testzip() is None
print(json.dumps({'html_bytes':(data / 'criterion-explorer.html').stat().st_size,'zip_bytes':(data / 'criterion-public-dataset.zip').stat().st_size,'files':len(files)}, indent=2))
