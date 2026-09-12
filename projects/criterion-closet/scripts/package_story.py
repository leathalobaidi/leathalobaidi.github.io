#!/usr/bin/env python3
"""Create a self-contained copy of the scrolling Criterion story."""
import argparse
import re
from pathlib import Path
from urllib.parse import urljoin

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('output', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
story = root / 'discover'
html = (story / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="story.css">', '<style>' + (story / 'story.css').read_text() + '</style>')
html = re.sub(r'<!-- Cloudflare Web Analytics -->.*?<!-- End Cloudflare Web Analytics -->', '', html, flags=re.S)
for src in ['../explorer/model.js', 'story-model.js', 'story.js']:
    html = html.replace(f'<script src="{src}" defer></script>', '')
html = re.sub(r'^[ \t]+$', '', html, flags=re.M)
base = 'https://leathalobaidi.com/projects/criterion-closet/discover/'
html = re.sub(r'href="([^"]+)"', lambda m: m.group(0) if m[1].startswith(('#', 'https:', 'http:')) else 'href="' + urljoin(base, m[1]) + '"', html)
html = html.replace('<body>', '<body data-explorer-base="https://leathalobaidi.com/projects/criterion-closet/explorer/">')
embedded = '<script id="embedded-data" type="application/json">' + (root / 'explorer/data/explorer-data.json').read_text().replace('<', '\\u003c') + '</script>'
for path in [root / 'explorer/model.js', story / 'story-model.js', story / 'story.js']:
    embedded += '<script>' + path.read_text() + '</script>'
html = html.replace('</body>', embedded + '\n</body>')
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
print(f'Created {args.output.name}: {args.output.stat().st_size:,} bytes')
