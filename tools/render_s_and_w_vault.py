#!/usr/bin/env python3
from __future__ import annotations

import html
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "vault" / "s-and-w"
CSS = BASE / "assets" / "readable.css"


def slugify(text: str, used: set[str]) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    slug = slug or "section"
    original = slug
    i = 2
    while slug in used:
        slug = f"{original}-{i}"
        i += 1
    used.add(slug)
    return slug


def inline(text: str) -> str:
    tokens: list[tuple[str, str]] = []

    def stash(markup: str) -> str:
        token = f"@@TOKEN{len(tokens)}@@"
        tokens.append((token, markup))
        return token

    def code_repl(match: re.Match[str]) -> str:
        return stash(f"<code>{html.escape(match.group(1))}</code>")

    def img_repl(match: re.Match[str]) -> str:
        alt = html.escape(match.group(1).replace("\\", " ").strip())
        src = html.escape(match.group(2), quote=True)
        return stash(f'<img src="{src}" alt="{alt}">')

    def link_repl(match: re.Match[str]) -> str:
        label = inline(match.group(1))
        href = html.escape(match.group(2), quote=True)
        return stash(f'<a href="{href}">{label}</a>')

    text = re.sub(r"`([^`]+)`", code_repl, text)
    text = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", img_repl, text)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link_repl, text)
    text = html.escape(text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", text)

    for _ in range(3):
        for token, markup in tokens:
            text = text.replace(token, markup)
    return text


def is_table_separator(line: str) -> bool:
    if "|" not in line:
        return False
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c or "") for c in cells)


def split_table_row(line: str) -> list[str]:
    return [c.strip() for c in line.strip().strip("|").split("|")]


def render_table(lines: list[str]) -> str:
    rows = [split_table_row(line) for line in lines]
    if len(rows) < 2:
        return ""
    header = rows[0]
    body = rows[2:] if is_table_separator(lines[1]) else rows[1:]
    out = ["<table>", "<thead><tr>"]
    out.extend(f"<th>{inline(cell)}</th>" for cell in header)
    out.append("</tr></thead>")
    if body:
        out.append("<tbody>")
        for row in body:
            if len(row) < len(header):
                row += [""] * (len(header) - len(row))
            out.append("<tr>")
            out.extend(f"<td>{inline(cell)}</td>" for cell in row[: len(header)])
            out.append("</tr>")
        out.append("</tbody>")
    out.append("</table>")
    return "\n".join(out)


def collect_paragraph(lines: list[str], start: int) -> tuple[str, int]:
    parts: list[str] = []
    i = start
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped:
            break
        if stripped.startswith("#") or stripped.startswith("```") or stripped.startswith(">"):
            break
        if re.match(r"^[-*]\s+", stripped) or re.match(r"^\d+\.\s+", stripped):
            break
        if "|" in stripped and i + 1 < len(lines) and is_table_separator(lines[i + 1].strip()):
            break
        parts.append(stripped)
        i += 1
    return " ".join(parts), i


def render_markdown(text: str) -> tuple[str, list[dict[str, str]], str, str]:
    lines = text.splitlines()
    out: list[str] = []
    toc: list[dict[str, str]] = []
    used: set[str] = set()
    title = "S&W Vault Note"
    first_paragraph = ""
    seen_h1 = False
    i = 0

    while i < len(lines):
        raw = lines[i]
        line = raw.strip()

        if not line:
            i += 1
            continue

        if line.startswith("```"):
            language = line.strip("`").strip()
            code_lines: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            i += 1 if i < len(lines) else 0
            klass = f' class="language-{html.escape(language)}"' if language else ""
            out.append(f"<pre><code{klass}>{html.escape(chr(10).join(code_lines))}</code></pre>")
            continue

        heading = re.match(r"^(#{1,4})\s+(.+)$", line)
        if heading:
            level = len(heading.group(1))
            label = heading.group(2).strip()
            text_label = re.sub(r"<[^>]+>", "", label)
            ident = slugify(re.sub(r"[`*_]+", "", text_label), used)
            if level == 1 and title == "S&W Vault Note":
                title = re.sub(r"[`*_]+", "", text_label)
                seen_h1 = True
                i += 1
                continue
            if level in (2, 3):
                toc.append({"level": f"h{level}", "text": re.sub(r"[`*_]+", "", text_label), "id": ident})
            out.append(f'<h{level} id="{ident}">{inline(label)}</h{level}>')
            i += 1
            continue

        if line.startswith(">"):
            quote_lines: list[str] = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote_lines.append(lines[i].strip()[1:].strip())
                i += 1
            paragraphs = [p.strip() for p in "\n".join(quote_lines).split("\n>") if p.strip()]
            if not paragraphs:
                paragraphs = [" ".join(q for q in quote_lines if q)]
            out.append("<blockquote>")
            for para in paragraphs:
                out.append(f"<p>{inline(para)}</p>")
            out.append("</blockquote>")
            continue

        if "|" in line and i + 1 < len(lines) and is_table_separator(lines[i + 1].strip()):
            table_lines = [lines[i], lines[i + 1]]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                table_lines.append(lines[i])
                i += 1
            out.append(render_table(table_lines))
            continue

        if re.match(r"^[-*]\s+", line):
            out.append("<ul>")
            while i < len(lines) and re.match(r"^[-*]\s+", lines[i].strip()):
                item = re.sub(r"^[-*]\s+", "", lines[i].strip())
                out.append(f"<li>{inline(item)}</li>")
                i += 1
            out.append("</ul>")
            continue

        if re.match(r"^\d+\.\s+", line):
            out.append("<ol>")
            while i < len(lines) and re.match(r"^\d+\.\s+", lines[i].strip()):
                item = re.sub(r"^\d+\.\s+", "", lines[i].strip())
                out.append(f"<li>{inline(item)}</li>")
                i += 1
            out.append("</ol>")
            continue

        para, i = collect_paragraph(lines, i)
        if para:
            if title == "S&W Vault Note" and para.lower() in {"insights"}:
                continue
            if not first_paragraph and seen_h1 and not para.startswith("![") and not para.lower().startswith(("author", "published", "read time", "insights")):
                first_paragraph = re.sub(r"\s+", " ", re.sub(r"[`*_]+", "", para))
            out.append(f"<p>{inline(para)}</p>")
        else:
            i += 1

    return "\n".join(out), toc, title, first_paragraph


def doc_type(path: Path) -> str:
    if "source-articles" in path.parts:
        return "Source article"
    if "jonathan" in path.name:
        return "Interview prep"
    if "mobility" in path.name:
        return "Case exam"
    if "negotiation" in path.name:
        return "Interview script"
    return "Vault note"


def render_page(md_path: Path) -> Path:
    body, toc, title, summary = render_markdown(md_path.read_text(encoding="utf-8"))
    out_path = md_path.with_suffix(".html")
    css_href = Path("../assets/readable.css") if "source-articles" in md_path.parts else Path("assets/readable.css")
    index_href = "../index.html" if "source-articles" in md_path.parts else "index.html"
    source_href = md_path.name
    if "source-articles" in md_path.parts:
        source_href = md_path.name

    toc_html = ""
    if toc:
        toc_html = "<nav class=\"toc\" aria-label=\"On this page\">\n<h2>On this page</h2>\n"
        for item in toc[:36]:
            toc_html += f'<a class="{item["level"]}" href="#{item["id"]}">{html.escape(item["text"])}</a>\n'
        toc_html += "</nav>"

    summary_html = f'<p class="summary">{html.escape(summary)}</p>' if summary else ""
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{html.escape(title)} - S&amp;W Vault</title>
<link rel="stylesheet" href="{html.escape(str(css_href))}">
</head>
<body>
<main class="page">
  <div class="topbar">
    <a class="crumb" href="{html.escape(index_href)}">Back to S&amp;W vault</a>
    <a class="source-link" href="{html.escape(source_href)}">Markdown source</a>
  </div>
  <header class="hero">
    <div class="eyebrow">{html.escape(doc_type(md_path))}</div>
    <h1>{html.escape(title)}</h1>
    {summary_html}
  </header>
  <div class="layout">
    <article class="article">
{body}
    </article>
    {toc_html}
  </div>
  <p class="footer-note">Private S&amp;W preparation material. Generated from the local Markdown source for easier reading.</p>
</main>
</body>
</html>
"""
    out_path.write_text(page, encoding="utf-8")
    return out_path


def main() -> None:
    files = sorted(BASE.glob("*.md")) + sorted((BASE / "source-articles").glob("*.md"))
    for path in files:
        print(render_page(path).relative_to(ROOT))


if __name__ == "__main__":
    main()
