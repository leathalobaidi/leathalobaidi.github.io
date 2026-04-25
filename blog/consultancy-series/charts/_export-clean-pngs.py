"""
Re-export each interactive chart in the consultancy-series as a clean PNG
(annotations stripped) for the mobile fallback. Run after chart edits.

Usage: python3 _export-clean-pngs.py
Output: ./chart-<id>.png in this folder.
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
SERIES = HERE.parent

# (html-file, chart-id, kind). Kind: 'echarts', 'leaflet', 'chord-svg'.
TARGETS = [
    ('part0.1-visual-story.html', 'chart-1', 'echarts'),
    ('part0.1-visual-story.html', 'chart-2', 'echarts'),
    ('part0.1-visual-story.html', 'chart-3', 'echarts'),
    ('part0.1-visual-story.html', 'chart-history', 'echarts'),
    ('part0.1-visual-story.html', 'chart-4', 'echarts'),
    ('part0.1-visual-story.html', 'chart-5', 'echarts'),
    ('part0.1-visual-story.html', 'chart-6', 'echarts'),
    ('part0.1-visual-story.html', 'chart-7', 'echarts'),
    ('part0.1-visual-story.html', 'chart-7b', 'echarts'),
    ('part0.1-visual-story.html', 'chart-j', 'echarts'),
    ('part0.1-visual-story.html', 'chart-g', 'echarts'),
    ('part0.1-visual-story.html', 'chart-h', 'echarts'),
    ('part0.1-visual-story.html', 'chart-age', 'echarts'),
    ('part0.2-uk-and-global-map.html', 'uk-map', 'leaflet'),
    ('part0.2-uk-and-global-map.html', 'city-map', 'leaflet'),
    ('part0.2-uk-and-global-map.html', 'chart-network', 'echarts'),
    ('part5-profit-machine.html', 'chart-deals', 'echarts'),
    ('part7-the-people-network.html', 'chord', 'chord-svg'),
    ('rbb-2m-to-108m.html', 'chart-rbb', 'echarts'),
]


STRIP_ECHARTS = """
(function(id){
  if (typeof echarts === 'undefined') return false;
  var el = document.getElementById(id);
  if (!el) return false;
  var inst = echarts.getInstanceByDom(el);
  if (!inst) return false;
  // Keep labels, markPoints, markLines, and graphic annotations as-is —
  // mobile screenshots should match the desktop reading experience.
  // Just trigger a resize to make sure the chart has finished layout.
  inst.resize();
  return true;
})('__ID__');
"""

STRIP_CHORD = """
(function(){ return true; })();
"""


async def export_one(page, html, chart_id, kind):
    url = f'file://{SERIES}/{html}'
    print(f'  loading {html}#{chart_id}')
    await page.goto(url, wait_until='networkidle')
    # Give charts a moment to finish rendering
    await page.wait_for_timeout(1500)

    if kind == 'echarts':
        ok = await page.evaluate(STRIP_ECHARTS.replace('__ID__', chart_id))
        if not ok:
            print(f'    WARN: ECharts strip failed for {chart_id}')
    elif kind == 'chord-svg':
        await page.evaluate(STRIP_CHORD)

    await page.wait_for_timeout(500)

    el = await page.query_selector(f'#{chart_id}')
    if not el:
        print(f'    WARN: element #{chart_id} not found')
        return
    out = HERE / f'{chart_id}.png'
    await el.screenshot(path=str(out), omit_background=False)
    print(f'    -> {out.name} ({out.stat().st_size // 1024} kB)')


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={'width': 1100, 'height': 800},
            device_scale_factor=2,
        )
        page = await ctx.new_page()
        for html, chart_id, kind in TARGETS:
            try:
                await export_one(page, html, chart_id, kind)
            except Exception as e:
                print(f'    ERROR on {html}#{chart_id}: {e}')
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
