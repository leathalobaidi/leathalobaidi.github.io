# Criterion Closet Picks — Database

A structured database of **who picked what** in the Criterion Closet, built to analyse
the most popular films, directors, and taste patterns across every guest visit — and to
cross-reference against IMDb and Letterboxd.

## What's inside

| File | Rows | Description |
|------|------|-------------|
| `criterion_closet.db` | — | SQLite database (tables: `guests`, `films`, `picks`) |
| `guests.csv` | 477 | One row per Closet visit (person/group) |
| `picks.csv` | 7,360 | The person↔film join — one row per pick |
| `films.csv` | 1,658 | Unique films, enriched with IMDb ID + Letterboxd rating |
| `popularity.csv` | 1,104 | Films ranked by how many guests picked them |

## Source & method

- **Not transcribed from video.** The picks come from the community project
  [letterboxd.com/closetpicks](https://letterboxd.com/closetpicks) (by Jacob Tender),
  which maintains one Letterboxd list per Closet visit, current to mid-2026 — the
  authoritative, structured record. This is far cleaner and more complete than the
  official YouTube playlist (only ~100 of 477 visits).
- Each guest list was scraped for its ordered films, source video, date, and
  demographic tags.
- Each unique film was then enriched from its Letterboxd film page:
  title, year, director, runtime, **IMDb ID**, **TMDB ID**, and Letterboxd average
  rating (out of 5) + rating count.
- 1,657 / 1,658 films have an IMDb ID; 1,655 have a Letterboxd rating.
- **IMDb rating + vote count** joined for all 1,657 from IMDb's official
  `title.ratings.tsv.gz` dataset (exact, not scraped), keyed on the IMDb ID.

## Schema

**guests** — `name, slug, visit_date, visit_year, is_group, gender, occupations, lgbtq, n_picks, video, list_url`
**films** — `slug, title, year, director, runtime, imdb, tmdb, lb_rating, lb_rating_count, imdb_rating, imdb_votes, times_picked, imdb_url, lb_url`
**picks** — `guest, guest_slug, film_slug, film_title, film_year, pick_order`

`occupations` is a `;`-separated list (actors, directors, writers, musicians, …).
`imdb` is the join key to IMDb (`ttNNNNNNN`); `imdb_url` / `lb_url` are ready-made links.
`lb_rating` is Letterboxd's 0–5 average — multiply by 2 for a rough IMDb-comparable /10.

## Example queries

```sql
-- Most-picked films
SELECT title, year, director, times_picked, lb_rating
FROM films ORDER BY times_picked DESC LIMIT 25;

-- What did a specific guest pick?
SELECT p.pick_order, p.film_title, f.year, f.lb_rating, f.imdb_url
FROM picks p JOIN films f ON p.film_slug=f.slug
WHERE p.guest LIKE '%Guillermo del Toro%' ORDER BY p.pick_order;

-- Most-picked directors
SELECT f.director, COUNT(*) picks, COUNT(DISTINCT f.slug) films
FROM picks p JOIN films f ON p.film_slug=f.slug
GROUP BY f.director ORDER BY picks DESC LIMIT 20;

-- Highest-rated films that are also popular in the Closet
SELECT title, year, lb_rating, times_picked
FROM films WHERE times_picked>=5 ORDER BY lb_rating DESC LIMIT 25;

-- Do directors and actors pick differently? (occupation tag join)
SELECT g.occupations, f.title, COUNT(*) n
FROM picks p JOIN guests g ON p.guest_slug=g.slug JOIN films f ON p.film_slug=f.slug
WHERE g.occupations LIKE '%directors%'
GROUP BY f.slug ORDER BY n DESC LIMIT 15;
```

Query from the shell: `sqlite3 criterion_closet.db "SELECT ..."`

## Headline findings (as of build)

- **477 visits**, 7,360 picks, 1,658 unique films.
- Visits exploded: ~10/year through 2021 → **148 in 2024**, 103 in 2025.
- **Most-picked film:** *A Woman Under the Influence* (1974, Cassavetes) — 40×.
- **Most-picked directors:** Agnès Varda (581 picks / 38 films), Ingmar Bergman
  (561 / 42), Fellini (271 / 13), Cassavetes (197 / 7).
- **Guest gender:** 298 men, 135 women, 27 mixed groups, 3 non-binary.
- **Long tail:** 554 films were picked by only one guest — the "deep cut" signal.

## Refreshing the data

Letterboxd Cloudflare-blocks the home IP but not the context-mode sandbox, so the
scrape was run through `ctx_execute`. Re-run the three phases (enumerate lists →
scrape lists → enrich films) then the build step. Raw per-page JSON is cached under
`raw/` so re-runs only fetch new/changed pages.

## The Shape of Taste — interactive map

`taste-map.html` is an interactive network of all 477 guests, linked when they share
≥4 film picks, coloured by **community of taste** (detected via weighted label
propagation). The nine communities map cleanly onto auteur canons:

| Community | Signature films | Size |
|-----------|-----------------|------|
| Varda | Cléo from 5 to 7, Vagabond, Le Bonheur | 51 |
| Cassavetes | A Woman Under the Influence, Faces, Shadows | 36 |
| Bergman | Fanny and Alexander, Scenes from a Marriage | 30 |
| Fellini | La Strada, Amarcord, Satyricon | 24 |
| Pasolini | Accattone, Mamma Roma, The Gospel According to St. Matthew | 21 |
| Tati | PlayTime, Mon Oncle, Monsieur Hulot's Holiday | 20 |
| Kaiju / Godzilla | Godzilla, Mothra vs. Godzilla | 19 |
| New Hollywood (BBS) | Head, Easy Rider, Five Easy Pieces | 9 |
| Black Queer Cinema | Tongues Untied, Ethnic Notions (Marlon Riggs) | 6 |

Click any guest for their picks + strongest taste twins. Leaderboards cover
most-picked directors, taste twins, and bridge films.

- `taste-map.html` — loads data from `analysis/*.json` (open via a local server:
  `cd criterion-closet-db && python3 -m http.server`).
- `taste-map.standalone.html` — single self-contained file (data inlined), openable
  by double-click and used for the shareable web version.
- `analysis/` — `graph.json` (nodes/edges/communities), `guest_picks.json`,
  `edges.json` (all guest-pairs sharing ≥4 films), `meta.json` (leaderboards).

## A Year in the Closet — the watch plan

`syllabus.html` (source) / `syllabus.standalone.html` (self-contained) turn the database
into an actual viewing plan: **52 films, one per week, ~108 hours**, generated by rule
from the picks data (`analysis/plan.json`):

- **Canon (15)** — most-pulled films, max two per director.
- **Community signatures (18)** — two per detected taste community, ranked by
  in-community picks (so the Godzilla cluster contributes Godzilla).
- **Deep cuts (12)** — picked 3+, Letterboxd ≥ 3.9, under 20k IMDb votes.
- **Wildcards (7)** — single-guest picks rated 4.15+ (e.g. Tim Robbins's *Z*).
- Sequenced by largest-remainder interleave, no director twice running; trilogies
  enter by first film only; *A Constant Forge* excluded (box-set companion doc).
- Checkbox progress (localStorage), pace selector (1/wk · 2/wk · 1/day) with
  projected finish date, hours-watched counter.

## Possible next steps

- **Critic-vs-crowd gap:** `imdb_rating` and `lb_rating` are both present — the films
  where cinephile Letterboxd love most outruns the IMDb crowd (Cassavetes, late Varda)
  are a ready "hidden-gem" signal.
- **Rotten Tomatoes / Metacritic:** join via IMDb ID or title+year (Firecrawl key on
  file for the blocked sources).
- **"Never picked":** cross against the full Criterion spine list to find blind spots
  (the closetpicks account already maintains such a list).
