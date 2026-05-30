# UK Economics Consultancy — Source of Truth

This folder is the canonical record for the consultancy series at
`blog/consultancy-series/`. The blog HTML is a *view* over this data; when
the two disagree, the data wins and the prose is corrected.

## Files

| File | One row per | Keyed by |
|---|---|---|
| `firms.csv` | Firm (trading name) | `firm_id` |
| `people.csv` | Person | `person_id` |
| `events.csv` | Dated event (founded, acquired, office opened, exit, etc.) | `event_id` |
| `affiliations.csv` | Person ↔ firm tenure | `(person_id, firm_id, start_date)` |
| `sources.csv` | One citable URL or document | `source_id` |
| `corrections.md` | Human-readable diff: blog says X, source-of-truth says Y | — |

## ID conventions

- `firm_id`: snake_case slug of the trading name. `london_economics`, `cra`,
  `compass_lexecon`, `rbb`, `frontier`, `oxera`, `nera`, `capital_economics`.
- `firm_id` for **distinct Companies House entities** under the same trading
  name are suffixed: e.g. `london_economics__ch_04083204`. This is what makes
  the "founded 1986 but the current CH entity dates to Oct 2000" distinction
  representable without contradiction.
- `person_id`: snake_case slug of full name. `john_kay`, `nick_morris`,
  `simon_gaysford`.

## Event types

- `founded` — firm starts trading (not Companies House date).
- `incorporated` — Companies House entity registered.
- `renamed` — CH entity renamed.
- `office_opened` — new geographic office launched.
- `acquired` — `firm_id` acquires `counterparty_firm_id`.
- `acquired_by` — `firm_id` is acquired by `counterparty_firm_id`.
- `spin_out` — `firm_id` spins out of `counterparty_firm_id`.
- `mbo` — management buy-out.
- `pe_investment` — minority or majority PE stake.
- `rename` — trading name changes.
- `key_hire` / `key_departure` — named senior moves.

## Sources

Every row in `events.csv`, `firms.csv`, and `affiliations.csv` carries a
`source_id` pointing at `sources.csv`. Source types:
`companies_house`, `firm_website`, `press_release`, `news`, `wikipedia`,
`primary_doc`, `interview`. `interview` rows must list the interviewee and
date in `notes` — these are the rows that fix the "you didn't actually talk
to anyone" critique.

## How the loop closes

1. Edit a row in the CSVs.
2. Re-run `scripts/check_blog.py` (TODO — to be written once the desktop file
   lands).
3. The script produces an updated `corrections.md` listing every
   `blog/consultancy-series/*.html` line that disagrees with the data.
4. Apply the edits to the HTML.
5. Commit data + HTML in the same commit.

## Seed data

The seed CSVs contain only facts that have been verified to a named primary
source in this branch's research, plus the corrections triggered by Mike's
review. They are intentionally sparse — the full population comes from the
desktop file `~/Downloads/ch Econ consultancy`, which will be merged in.
