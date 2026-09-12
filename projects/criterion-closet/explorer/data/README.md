# Criterion Explorer dataset

Snapshot: 12 September 2026. Independent project by Leath Al Obaidi.

The explorer contains the current Criterion catalogue and the structured selections on every page in the official Closet and written Top 10 indexes. These inventories are complete for the dated indexes; this is not an exhaustive transcription of every spoken recommendation or editorial mention.

| Inventory | Count |
| --- | ---: |
| Current catalogue entries | 1,872 |
| Film-path entries, including compilations and series | 1,718 |
| Box-set-path entries | 154 |
| Indexed Closet visits | 410 |
| Displayed Closet selections | 3,381 |
| Written Top 10 articles | 272 |
| Written-list title entries | 3,075 |
| Combined direct selection rows | 6,456 |
| Referenced items, including the catalogue | 1,874 |

The two extra items are the historical *Rebel Samurai: Sixties Swordplay Classics* set and a Criterion tote bag. The tote bag remains in its guest's record and is classified as `other`; it does not enter the default film/release rankings. Thus 3,380 of the Closet choices are film or set entries.

## Files

- `criterion-explorer.html`: standalone HTML with the explorer and all source tables embedded. Filtering works without a data server; external links and fonts still use the internet.
- `explorer-data.json`: the data consumed by the website. Contains `items`, `events`, `setMembers`, `counts`, `coverage`, and `sourceTables`.
- `catalogue.csv`: the complete current catalogue with namespaced IDs, credits where sourced, and external links.
- `events.csv`: all 682 canonical indexed visit/list records and sourced roles.
- `choices.csv`: all 6,456 source-attributed choices, with event and item IDs.
- `criterion-public-sources.sqlite`: the imported source tables plus the curated `explorer_items`, `explorer_events`, `explorer_choices`, and `explorer_set_members` tables. The curated tables have primary/foreign-key constraints. In the source tables, nested fields are JSON text.
- `sources/`: every imported source table in JSON and CSV, plus all directly acquired official Closet choices. These include the older website and community datasets and therefore overlap heavily. Their rows are available for comparison but do not add votes to the curated rankings.
- `official-closet-pages.json`: all 410 official page records with linked choices and sourced introductory role labels. Availability badges that preceded a title were resolved against the official catalogue by namespaced ID, retaining the original extracted label in `source_title_label`.
- `written-guest-metadata.json`: publication dates and introductory role labels for all 272 written lists. Full biographies are omitted.
- `role-reviews.json`: reviewed profession mappings, the supporting Criterion URLs and the method. The same records are maintained in `scripts/role-overrides.json`.
- `source-manifest.json`: original acquisition URLs, dates and SHA-256 hashes. Original-download hashes differ from transformed public exports.
- `checksums.json`: checksums of the published files, excluding the checksums file and ZIP itself.

## Identity and counts

Criterion item IDs include their namespace: `films:528` is *The Silence of the Lambs*; `boxsets:528` is *Andrzej Wajda: Three War Films*. There are 48 such numeric-ID collisions in the current catalogue. Original source paths remain available in the imported tables; older sources may contain wrong paths and are not silently merged into the curated vote counts.

Events use `closet:<collection ID>` and `top10:<list ID>`. The primary page is the authority for its displayed selections. Catalogue film entries are not necessarily individual feature films: they include shorts, series, compilations and alternative versions. The data does not silently collapse different Criterion release IDs into one work.

The default count is distinct visits/articles containing a directly selected item. A set counts once as a selected release. The optional set-contents view includes known member entries and still counts each reached item at most once per event, including when it was also directly selected. Nonempty contents mappings cover 101 selected sets and are incomplete; an unmapped set is unknown, not empty.

The distinct-guest-name count deduplicates normalized names across repeat appearances. It does not claim to resolve every alias or homonym into a biographical identity. Joint contributions remain one joint selector and are excluded from individual-profession cohorts. A person can belong to several profession groups and counts once within each selected cohort.

632 of 634 solo event records have sourced profession labels; 48 event records have joint guests. Role labels combine the source databases, explicit guest introductions and reviewed biographies. They describe reported professional work, not necessarily the person's current primary occupation. Unknown professions remain visible.

Published written-list rank markers are preserved. 345 title entries have no separate rank marker, often because of ties or grouped choices. A blank is not an inferred rank. No ranking uses list position as preference strength. The original commentary and source page establish grouping and context.

Percentages divide a title's selected event/guest count by the eligible event/guest cohort after source, profession and guest filters. Film-specific filters restrict the displayed titles without changing that guest cohort. Unselected catalogue entries mean no recorded selection in these sources, not dislike.

## Reproduce

From the repository's `projects/criterion-closet/` directory, rebuild using the public source database and saved primary-page metadata:

```sh
python3 scripts/build_explorer.py explorer/data/criterion-public-sources.sqlite explorer/data/official-closet-pages.json /tmp/criterion-rebuild
node --test scripts/test_explorer.cjs
```

Use a separate output directory for a rebuild. `written-guest-metadata.json` must be next to `official-closet-pages.json`; reviewed role mappings live next to the builder. Only original import tables are consumed on a subsequent build. `scripts/package_explorer.py` makes the standalone HTML and ZIP after rebuilding.

For example, count directly selected film-path entries across the written lists in SQLite:

```sql
SELECT i.id, i.title, COUNT(DISTINCT e.id) AS written_lists
FROM explorer_choices c
JOIN explorer_events e ON e.id = c.event_id
JOIN explorer_items i ON i.id = c.item_id
WHERE e.format = 'top10' AND i.kind = 'film'
GROUP BY i.id, i.title
ORDER BY written_lists DESC, i.title;
```

This yields *A Woman Under the Influence* on 29 lists, *Brazil* on 26, and *The Third Man* on 25. Combined-format counts differ.

## Sources and public export

Primary: [Criterion catalogue](https://www.criterion.com/shop/browse/list?sort=spine_number), [Closet index](https://www.criterion.com/closet-picks/search), and [written Top 10 archive](https://www.criterion.com/current/top-10-lists). Individual source URLs accompany events and choices.

Reused data: [Neel Baronia](https://github.com/neelbaronia/criterion-closet-explorer), [Britton Walker](https://github.com/brittonwalker/criterion-top-ten), [Weston Westenborg](https://closetpicks.westenb.org/llm-export/), [arrismo](https://github.com/arrismo/criterioncollection), and the site's original Closet database.

The public release contains metadata and links. Full editorial prose, selection quotes, biographies, video files, posters, personal demographic fields and legacy numeric IMDb/Letterboxd rating observations are omitted. Existing provider film links are retained. The public explorer does not present numeric ratings as current or licensed for redistribution. Historical source snapshots have different dates; a retrieval date is not a rating-observation date.
