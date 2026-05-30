# Blog corrections — `consultancy-series/` vs source of truth

Each row below is a discrepancy between the prose in `blog/consultancy-series/`
and the verified data in this folder. Status meanings: **open** = needs editing
in the HTML; **closed** = corrected.

The Mike call (May 2026) flagged these by skim. The London Economics one is
the high-profile one — it should be fixed before the next reply.

---

## C-001 — London Economics: founding date and founders missing

**Severity:** high (the lead error Mike cited)
**Status:** open

- **File:** `blog/consultancy-series/part2-founders-decade.html`
- **Lines:** 172–174 (table row), 199 (callout)

**Blog says:**
- Table row (line 173): "London Economics | Oct 2000 (London) | Incorporated as current entity".
- Callout (line 199): "London Economics Ltd, founded in the late 1980s, was the training ground for a generation."

**Source of truth:**
- LE was **founded in 1986** by **John Kay** and **Nick Morris**.
  Source: johnkay.com/about — "establish a consulting company, London
  Economics" in 1986, alongside taking the LBS chair (`src_johnkay_about`).
- The "Oct 2000" date is the incorporation of **HAMSARD 2219 LIMITED** (CH
  04083204), a shelf company that was renamed *New London Economics Limited*
  on 17 Nov 2000 and *London Economics Limited* on 22 Sep 2004
  (`src_ch_04083204`). It is **not** the founding date of the consultancy.

**Edits required:**
1. Change the table row to: `London Economics | 1986 (London) | John Kay,
   Nick Morris`. Add a footnote that the current CH entity (04083204) was
   re-registered in 2000.
2. Change "founded in the late 1980s" → "founded in **1986** by John Kay
   and Nick Morris".
3. Add Kay and Morris to `part1` and `part2` wherever London Economics is
   discussed as a training ground.

---

## C-002 — Frontier Economics: May vs June 1999 (internal contradiction)

**Severity:** medium
**Status:** open

- **Files:**
  - `part2-founders-decade.html:163` (table cell: "May 1999")
  - `part2-founders-decade.html:192` (prose: "Launched in June 1999")
  - `part0.1-visual-story.html:693` (prose: "founded in May 1999")

**Source of truth:**
- Frontier's own About page and founder article: **June 1999**
  (`src_frontier_about`, `src_frontier_founding`).
- Companies House incorporation may predate the trading launch (some
  scaffolding companies are CHed in May, trading starts in June). If so,
  say so explicitly; do not present two different launch months as both
  "founded".

**Edits required:**
- Standardise on "**Launched June 1999**" everywhere; if the CH
  incorporation date is distinct, render as: "incorporated May 1999,
  trading June 1999".

---

## C-003 — Frontier "out of London Economics and the Bank of England"

**Severity:** medium
**Status:** open

- **File:** `part4-global-arms-race.html:278`

**Blog says:**
> "…since Simon Gaysford, Philip Burns, Dan Elliott, Zoltan Biro and Michael
> Webb founded it out of London Economics and the Bank of England in 1999…"

**Source of truth:**
- Gaysford and Elliott were ex-London Economics (`src_frontier_founding`).
- The "Bank of England" connection for the other board members is not
  substantiated by any source currently in `sources.csv`.

**Edits required:**
- Either find a primary source for the Bank of England claim and add it as
  a source row, or strike the phrase. Don't leave an unsourced lineage in
  prose. Note: this claim is not made in `part2`, only `part4`, so
  removing it from `part4` is consistent with the rest of the series.

---

## C-004 — CRA London opening date (defensive note)

**Severity:** low — your blog is **correct**; this is a note for the
reply to Mike, not an edit.
**Status:** no edit required

- **File:** `part2-founders-decade.html:238`

**Blog says:**
> "Walker had moved in August 2000 to open the London office of Charles
> River Associates… The CRA London launch was announced by press release
> on 14 August 2000."

**Source of truth:**
- CRA's own investor-relations press release is dated **14 August 2000**
  and announces the "official opening" of the London office
  (`src_cra_pr_london`).

**Note for the call:**
- Mike said "Oct 2000 was when CRA set up its London office." This is
  off by ~two months. Likely cause of confusion: the table cell at
  `part2:173` ("Oct 2000" next to "London Economics") attached itself in
  his memory to the wrong firm. Fixing C-001 also de-fuses this point.

---

## C-005 — "London Economics Ltd, founded in the late 1980s"

**Severity:** medium (a knock-on from C-001)
**Status:** open

- **File:** `part2-founders-decade.html:199`

1986 is mid-1980s, not late 1980s. Once C-001 is fixed, replace "late
1980s" with "1986". Also state the founders' names rather than referring to
the firm as a faceless "training ground".

---

## Open work that is data, not prose

- Verify Nick Morris's co-founder role with a non-Wikipedia source. Best
  options: a contemporaneous press cutting (FT 1986–88), an LBS
  publication, or a direct quote from Kay or Morris. Until verified,
  `affiliations.csv` keeps Morris with source `src_wikipedia_john_kay`
  and the README's "interviews are required to fix Mike's critique" rule
  applies.
- Settle the Frontier May vs June question by checking Companies House
  for the original Frontier Economics Ltd CH number. Once the desktop
  file `~/Downloads/ch Econ consultancy` is merged in, that should be
  in the firms table; if not, add it.
- The series mentions a "Bank of England" lineage for Frontier's
  founders that has no source row. Add or remove.
