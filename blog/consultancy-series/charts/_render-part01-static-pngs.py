"""
Render static PNG fallbacks for the Part 0.1 charts that depend on FIRMS/TAIL.

This avoids browser-based file:// rendering and reads the data constants directly
from part0.1-visual-story.html so the mobile fallback images stay aligned with
the interactive charts.

Usage:
  python3 charts/_render-part01-static-pngs.py
"""

from __future__ import annotations

import math
import re
import textwrap
from dataclasses import dataclass
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent
SERIES = HERE.parent
HTML = SERIES / "part0.1-visual-story.html"
WIDTH = 1840
HEIGHT = 1362
BG = "#f5f5f7"
TEXT = "#1d1d1f"
TEXT_DIM = "#6e6e73"
GRID = "#e5e5ea"
POUND = "\u00a3"

SEGMENT_COLORS = {
    "Competition": "#0071e3",
    "Litigation": "#34c759",
    "Macro": "#af52de",
    "Overlap": "#ff9500",
    "Policy": "#8e8e93",
    "Regulation": "#5ac8fa",
    "Broad": "#ff2d55",
}


@dataclass(frozen=True)
class Firm:
    name: str
    cat: str
    rev: float
    op: float
    margin: float


def fmt_m(value: float) -> str:
    if value >= 100:
        return f"{POUND}{value:.0f}m"
    if value >= 10:
        return f"{POUND}{value:.1f}m" if value != round(value) else f"{POUND}{value:.0f}m"
    return f"{POUND}{value:.1f}m"


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        f"/System/Library/Fonts/Supplemental/{name}.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


FONT_BOLD_26 = load_font("Arial Bold", 26)
FONT_BOLD_30 = load_font("Arial Bold", 30)
FONT_BOLD_36 = load_font("Arial Bold", 36)
FONT_BOLD_22 = load_font("Arial Bold", 22)
FONT_REG_22 = load_font("Arial", 22)
FONT_REG_24 = load_font("Arial", 24)


def parse_data() -> tuple[list[Firm], dict[str, int]]:
    html = HTML.read_text(encoding="utf-8")
    block_match = re.search(r"const FIRMS = \[(.*?)\];", html, re.S)
    tail_match = re.search(r"const TAIL = \{([^}]+)\};", html)
    if not block_match or not tail_match:
        raise RuntimeError("Could not find FIRMS/TAIL constants in Part 0.1 HTML")

    firms: list[Firm] = []
    row_pattern = re.compile(
        r'\{name:"(?P<name>[^"]+)",\s*cat:"(?P<cat>[^"]+)",\s*'
        r"rev:(?P<rev>-?\d+(?:\.\d+)?),\s*op:(?P<op>-?\d+(?:\.\d+)?),\s*"
        r"margin:(?P<margin>-?\d+(?:\.\d+)?)\}"
    )
    for match in row_pattern.finditer(block_match.group(1)):
        firms.append(
            Firm(
                name=match.group("name"),
                cat=match.group("cat"),
                rev=float(match.group("rev")),
                op=float(match.group("op")),
                margin=float(match.group("margin")),
            )
        )

    tail = {key: int(value) for key, value in re.findall(r"(\w+):(\d+)", tail_match.group(1))}
    if len(firms) != 28 or len(firms) + sum(tail.values()) != 90:
        raise RuntimeError(f"Unexpected Part 0.1 universe: {len(firms)} + {sum(tail.values())}")
    return firms, tail


def parse_age_data() -> tuple[list[dict[str, object]], list[dict[str, object]], float]:
    html = HTML.read_text(encoding="utf-8")
    firm_match = re.search(r"const BY_FIRM = \[(.*?)\];", html, re.S)
    year_match = re.search(r"const BY_YEAR = \[(.*?)\];", html, re.S)
    mean_match = re.search(r"const meanAll = ([0-9.]+);", html)
    if not firm_match or not year_match or not mean_match:
        raise RuntimeError("Could not find chart-age constants in Part 0.1 HTML")

    firm_rows = []
    firm_pattern = re.compile(
        r"\{firm: '([^']+)',\s*age: ([0-9.]+),\s*n: (\d+),\s*cat: '([^']+)'\}"
    )
    for firm, age, n, cat in firm_pattern.findall(firm_match.group(1)):
        firm_rows.append({"firm": firm, "age": float(age), "n": int(n), "cat": cat})

    year_rows = []
    year_pattern = re.compile(r"\{y: (\d+), age: ([0-9.]+), n: (\d+)\}")
    for year, age, n in year_pattern.findall(year_match.group(1)):
        year_rows.append({"y": int(year), "age": float(age), "n": int(n)})

    return firm_rows, year_rows, float(mean_match.group(1))


def normalize_sizes(sizes: list[float], dx: float, dy: float) -> list[float]:
    total = sum(sizes)
    factor = dx * dy / total if total else 0
    return [size * factor for size in sizes]


def worst_ratio(row: list[float], side: float) -> float:
    if not row:
        return float("inf")
    row_sum = sum(row)
    row_min = min(row)
    row_max = max(row)
    side_sq = side * side
    return max(side_sq * row_max / (row_sum * row_sum), (row_sum * row_sum) / (side_sq * row_min))


def layout_row(row: list[float], x: float, y: float, dx: float, dy: float) -> tuple[list[tuple[float, float, float, float]], float, float, float, float]:
    rects = []
    row_sum = sum(row)
    if dx >= dy:
        height = row_sum / dx if dx else 0
        xx = x
        for size in row:
            width = size / height if height else 0
            rects.append((xx, y, width, height))
            xx += width
        return rects, x, y + height, dx, dy - height

    width = row_sum / dy if dy else 0
    yy = y
    for size in row:
        height = size / width if width else 0
        rects.append((x, yy, width, height))
        yy += height
    return rects, x + width, y, dx - width, dy


def squarify(sizes: list[float], x: float, y: float, dx: float, dy: float) -> list[tuple[float, float, float, float]]:
    sizes = [s for s in sizes if s > 0]
    rects: list[tuple[float, float, float, float]] = []
    row: list[float] = []
    while sizes:
        candidate = sizes[0]
        side = min(dx, dy)
        if not row or worst_ratio(row + [candidate], side) <= worst_ratio(row, side):
            row.append(candidate)
            sizes = sizes[1:]
        else:
            new_rects, x, y, dx, dy = layout_row(row, x, y, dx, dy)
            rects.extend(new_rects)
            row = []
    if row:
        new_rects, _, _, _, _ = layout_row(row, x, y, dx, dy)
        rects.extend(new_rects)
    return rects


def binary_treemap(items: list[tuple[object, float]], x: float, y: float, w: float, h: float) -> list[tuple[object, tuple[float, float, float, float]]]:
    """Balanced treemap for static fallbacks; avoids unreadable one-pixel strips."""
    if not items:
        return []
    if len(items) == 1:
        return [(items[0][0], (x, y, w, h))]

    items = sorted(items, key=lambda item: item[1], reverse=True)
    total = sum(value for _, value in items)
    half = total / 2
    acc = 0.0
    split = 1
    best_diff = float("inf")
    for index, (_, value) in enumerate(items, start=1):
        acc += value
        diff = abs(half - acc)
        if diff <= best_diff:
            split = index
            best_diff = diff
        else:
            break

    left = items[:split]
    right = items[split:]
    if not right:
        left = items[:1]
        right = items[1:]

    left_total = sum(value for _, value in left)
    right_total = sum(value for _, value in right)
    if w >= h:
        left_w = w * left_total / (left_total + right_total)
        return binary_treemap(left, x, y, left_w, h) + binary_treemap(right, x + left_w, y, w - left_w, h)

    top_h = h * left_total / (left_total + right_total)
    return binary_treemap(left, x, y, w, top_h) + binary_treemap(right, x, y + top_h, w, h - top_h)


def clean_name(name: str) -> str:
    for suffix in [" LLP", " Ltd", " Limited", " UK"]:
        name = name.replace(suffix, "")
    return name.replace(" & ", " &\n")


def draw_label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 4,
    max_lines: int = 3,
) -> int:
    words = text.replace("\n", " \n ").split()
    lines: list[str] = []
    current = ""
    for word in words:
        if word == "\n":
            if current:
                lines.append(current)
            current = ""
            continue
        trial = f"{current} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width or not current:
            current = trial
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    x, y = xy
    for line in lines[:max_lines]:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + line_gap
    return y


def render_treemap(firms: list[Firm], tail: dict[str, int]) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(img)
    segments: dict[str, list[tuple[str, float, str, float | None]]] = {}
    for firm in firms:
        segments.setdefault(firm.cat, []).append((firm.name, firm.rev, firm.cat, firm.rev))
    for cat, n in tail.items():
        for i in range(n):
            segments.setdefault(cat, []).append((f"Long-tail {i + 1}", 2, cat, None))

    order = sorted(segments, key=lambda c: sum(item[1] for item in segments[c]), reverse=True)
    segment_items = [(cat, sum(item[1] for item in segments[cat])) for cat in order]
    segment_rects_by_cat = dict(binary_treemap(segment_items, 6, 6, WIDTH - 12, HEIGHT - 12))

    for cat in order:
        rect = segment_rects_by_cat[cat]
        x, y, w, h = rect
        x, y, w, h = int(x), int(y), int(w), int(h)
        color = SEGMENT_COLORS[cat]
        draw.rectangle((x, y, x + w, y + h), fill=color, outline=BG, width=6)
        header_h = 62 if h > 100 else 42
        overlay = Image.new("RGBA", (max(w, 1), header_h), (0, 0, 0, 100))
        img.paste(overlay, (x, y), overlay)
        draw.text((x + 24, y + 18), cat.upper(), font=FONT_BOLD_30, fill="white")

        items = sorted(segments[cat], key=lambda item: item[1], reverse=True)
        child_x, child_y = x + 6, y + header_h + 4
        child_w, child_h = max(w - 12, 1), max(h - header_h - 10, 1)
        child_rects_by_item = binary_treemap([(item, item[1]) for item in items], child_x, child_y, child_w, child_h)
        for item, child in child_rects_by_item:
            name, _, item_cat, rev = item
            cx, cy, cw, ch = [int(v) for v in child]
            fill = "#d2d2d7" if rev is None else SEGMENT_COLORS[item_cat]
            outline = BG if rev is None else "white"
            draw.rectangle((cx, cy, cx + cw, cy + ch), fill=fill, outline=outline, width=3 if rev else 2)
            if rev is None or rev < 9 or cw < 105 or ch < 90:
                continue
            label_font = FONT_BOLD_26 if cw >= 150 and ch >= 120 else FONT_BOLD_22
            max_lines = 3 if ch >= 140 else 2
            y_after = draw_label(
                draw,
                (cx + 18, cy + 18),
                clean_name(name),
                label_font,
                "white",
                max(cw - 36, 40),
                max_lines=max_lines,
            )
            rev_y = max(y_after + 8, cy + ch - 44)
            if rev_y + FONT_REG_22.size <= cy + ch - 10:
                draw.text((cx + 18, rev_y), fmt_m(rev), font=FONT_REG_22, fill="white")

    img.save(HERE / "chart-1.png", optimize=True)


def ensure_exact_size(path: Path) -> None:
    image = Image.open(path).convert("RGB")
    if image.size == (WIDTH, HEIGHT):
        return
    canvas = Image.new("RGB", (WIDTH, HEIGHT), BG)
    canvas.paste(image, (0, 0))
    canvas.save(path, optimize=True)


def set_matplotlib_style() -> None:
    plt.rcParams.update(
        {
            "font.family": "Arial",
            "figure.facecolor": BG,
            "axes.facecolor": BG,
            "axes.edgecolor": "#d2d2d7",
            "axes.labelcolor": TEXT_DIM,
            "xtick.color": TEXT_DIM,
            "ytick.color": TEXT,
            "savefig.facecolor": BG,
            "savefig.edgecolor": BG,
        }
    )


def render_league(firms: list[Firm]) -> None:
    set_matplotlib_style()
    sorted_firms = sorted(firms, key=lambda f: f.rev)
    fig, ax = plt.subplots(figsize=(9.2, 6.81), dpi=200)
    fig.subplots_adjust(left=0.24, right=0.92, top=0.96, bottom=0.10)
    names = [f.name for f in sorted_firms]
    values = [f.rev for f in sorted_firms]
    colors = [SEGMENT_COLORS[f.cat] for f in sorted_firms]
    bars = ax.barh(names, values, color=colors, alpha=0.92, height=0.72)
    ax.set_xlim(0, 500)
    ax.set_xticks([0, 100, 200, 300, 400, 500])
    ax.set_xticklabels([f"{POUND}{v}m" for v in [0, 100, 200, 300, 400, 500]], fontsize=9, family="monospace")
    ax.tick_params(axis="y", labelsize=8.5, length=0, pad=6)
    ax.tick_params(axis="x", length=0, pad=10)
    ax.grid(axis="x", color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    for spine in ax.spines.values():
        spine.set_visible(False)
    for bar, firm in zip(bars, sorted_firms):
        x = bar.get_width()
        y = bar.get_y() + bar.get_height() / 2
        ax.text(x + 4, y, fmt_m(firm.rev), va="center", ha="left", fontsize=8.5, fontweight="bold", color=TEXT)
    out = HERE / "chart-2.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    ensure_exact_size(out)


def render_scatter(firms: list[Firm]) -> None:
    set_matplotlib_style()
    fig, ax = plt.subplots(figsize=(9.2, 6.81), dpi=200)
    fig.subplots_adjust(left=0.09, right=0.96, top=0.95, bottom=0.13)
    ax.set_xscale("log")
    ax.set_xlim(1, 600)
    ax.set_ylim(-10, 60)
    ax.set_xticks([1, 10, 100, 600])
    ax.set_xticklabels([f"{POUND}1m", f"{POUND}10m", f"{POUND}100m", f"{POUND}600m"], fontsize=9, family="monospace")
    ax.set_yticks([-10, 0, 10, 20, 30, 40, 50, 60])
    ax.set_yticklabels([f"{v}%" for v in [-10, 0, 10, 20, 30, 40, 50, 60]], fontsize=9, family="monospace")
    ax.grid(color=GRID, linewidth=0.8)
    ax.axhline(0, color="#333333", linewidth=0.8, linestyle=(0, (5, 3)))
    ax.set_xlabel(f"Revenue ({POUND}m, log scale)", fontsize=10, family="monospace", color=TEXT_DIM, labelpad=18)
    ax.set_ylabel("Operating Margin (%)", fontsize=10, family="monospace", color=TEXT_DIM, labelpad=18)
    for spine in ax.spines.values():
        spine.set_color("#d2d2d7")
        spine.set_linewidth(0.8)

    for firm in firms:
        size = max(90, math.sqrt(abs(firm.op or 1)) * 120)
        ax.scatter(
            firm.rev,
            firm.margin,
            s=size,
            color=SEGMENT_COLORS[firm.cat],
            alpha=0.88,
            edgecolor="white",
            linewidth=0.5,
            zorder=3,
        )

    annotations = {
        "RBB Economics LLP": (45, 53, "RBB Economics\n" + fmt_m(108) + " - 56.3% margin"),
        "Baringa Partners LLP": (250, 48, "Baringa Partners\n" + fmt_m(450) + " - 36.8% margin"),
        "FTI Consulting LLP": (250, 16, "FTI Consulting\n" + fmt_m(461) + " - 23.6% margin"),
        "A&M Europe LLP": (140, 31, "A&M Europe\nEUR301m, about " + fmt_m(255)),
        "Oxera Consulting LLP": (7, 35, "Oxera Consulting\n" + fmt_m(71) + " - 38.3% margin"),
        "Frontier Economics Ltd": (150, 6, "Frontier Economics\nemployee-owned margin"),
    }
    firm_map = {f.name: f for f in firms}
    for name, (tx, ty, label) in annotations.items():
        firm = firm_map[name]
        ax.annotate(
            label,
            xy=(firm.rev, firm.margin),
            xytext=(tx, ty),
            textcoords="data",
            ha="left",
            va="center",
            fontsize=8.5,
            color=TEXT,
            fontweight="bold",
            arrowprops={"arrowstyle": "-", "color": "#0071e3", "lw": 1.2, "shrinkA": 4, "shrinkB": 5},
            zorder=4,
        )

    out = HERE / "chart-3.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    ensure_exact_size(out)


def render_age() -> None:
    firm_rows, year_rows, mean_all = parse_age_data()
    set_matplotlib_style()
    fig = plt.figure(figsize=(9.2, 6.81), dpi=200)
    gs = fig.add_gridspec(2, 1, height_ratios=[1.0, 1.0], hspace=0.30)
    ax1 = fig.add_subplot(gs[0])
    ax2 = fig.add_subplot(gs[1])
    fig.subplots_adjust(left=0.19, right=0.96, top=0.95, bottom=0.08)

    ordered = list(reversed(firm_rows))
    names = [str(row["firm"]) for row in ordered]
    ages = [float(row["age"]) for row in ordered]
    colors = [SEGMENT_COLORS.get(str(row["cat"]), "#8e8e93") for row in ordered]
    bars = ax1.barh(names, ages, color=colors, height=0.70)
    ax1.set_xlim(34, 58)
    ax1.set_xticks([35, 40, 45, 50, 55, 58])
    ax1.set_xticklabels([f"{tick} yrs" for tick in [35, 40, 45, 50, 55, 58]], fontsize=8.5, family="monospace")
    ax1.tick_params(axis="y", labelsize=9, length=0, pad=6)
    ax1.tick_params(axis="x", length=0, pad=8)
    ax1.grid(axis="x", color=GRID, linewidth=0.8)
    ax1.axvline(mean_all, color=TEXT_DIM, linestyle=(0, (4, 3)), linewidth=0.9)
    ax1.text(mean_all - 1.7, len(names) + 0.1, f"market mean {mean_all:.1f}", fontsize=8.5, family="monospace", color=TEXT_DIM)
    ax1.text(34, len(names) + 0.6, "By firm - sorted ascending", fontsize=8.5, family="monospace", color=TEXT_DIM, fontweight="bold")
    for spine in ax1.spines.values():
        spine.set_visible(False)
    for bar, age in zip(bars, ages):
        ax1.text(age + 0.18, bar.get_y() + bar.get_height() / 2, f"{age:.1f}", va="center", fontsize=8.5, family="monospace", fontweight="bold", color=TEXT)

    years = [int(row["y"]) for row in year_rows]
    year_ages = [float(row["age"]) for row in year_rows]
    ax2.plot(years, year_ages, color="#0071e3", linewidth=2.2, marker="o", markersize=3.5)
    ax2.fill_between(years, year_ages, [38] * len(years), color="#0071e3", alpha=0.07)
    ax2.axhline(mean_all, color="#ff3b30", linestyle=(0, (4, 3)), linewidth=0.9)
    ax2.scatter([2002], [39.2], color="#ff9500", edgecolor="white", linewidth=1.2, zorder=4)
    ax2.text(2002.2, 39.45, "2002 low (39.2)", color="#ff9500", fontsize=8.5, fontweight="bold")
    ax2.text(2022.7, mean_all + 0.25, f"market mean {mean_all:.1f}", color="#ff3b30", fontsize=8.5, family="monospace")
    ax2.text(2000, 52.9, "Time trend - mean by year", fontsize=8.5, family="monospace", color=TEXT_DIM, fontweight="bold")
    ax2.set_xlim(2000, 2026)
    ax2.set_ylim(38, 52)
    ax2.set_yticks([38, 40, 42, 44, 46, 48, 50, 52])
    ax2.set_ylabel("Mean age (yrs)", fontsize=9, family="monospace", color=TEXT_DIM, labelpad=18)
    ax2.tick_params(axis="x", labelsize=8.5)
    ax2.tick_params(axis="y", labelsize=8.5)
    ax2.grid(color=GRID, linewidth=0.8)
    for spine in ax2.spines.values():
        spine.set_color("#d2d2d7")
        spine.set_linewidth(0.8)

    out = HERE / "chart-age.png"
    fig.savefig(out, dpi=200)
    plt.close(fig)
    ensure_exact_size(out)


def main() -> None:
    firms, tail = parse_data()
    render_treemap(firms, tail)
    render_league(firms)
    render_scatter(firms)
    render_age()
    print("Rendered chart-1.png, chart-2.png, chart-3.png, chart-age.png from Part 0.1 constants")


if __name__ == "__main__":
    main()
