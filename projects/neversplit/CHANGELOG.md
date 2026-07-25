# NeverSplit data changelog

## 2026-07-25

- Published the 503-security S&P 500 research snapshot using market prices dated 2026-07-24.
- Added exact rational factors, factor candidates, history-coverage states and field-level provenance.
- Added comparable IPO/listing classifications and prices where evidence survived review.
- Added a mixed-rights ledger, archive lookup links, JSON Schema and dated snapshot.
- Preserved unresolved factor disagreements instead of silently selecting a winner.
- Added locally cached company marks for all 503 securities, with a public source
  manifest and a generated ticker-badge fallback when no usable mark is retrievable.

Intentional data changes should add a dated entry here and update the validator’s
golden rows only when the new value has a source.
