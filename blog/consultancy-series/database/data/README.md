# Economics consultancy catalogue

November 2026 correction. Mike Walker and Michael Walker are one professional identity. The directory records the name used in the 2000 CRA release and the January 2026 start month confirmed by Frontier. The original Frontier announcement gave 5 January as the intended date, subject to final conflict checks. The accounts selection was frozen on 24 July 2026 and checked against the accounts, with exact references in the November edition.

This edition contains 90 firm catalogue entries and 229 professional or research person entries. This export uses schema 1.5.

The download includes 140 individually checked financial field observations, including comparative years and two explicit non-disclosures; 11 appointment/advisory relationships; 15 dated events; 84 dated registered-office observations across 80 legal entities and 109 office or contact-city observations from ten firms. Four registered addresses are superseded. Two city listings are historical. A dated observation can be historical even when it is the latest available record.

`public-data.json` contains the full public dataset. `economics-consultancy-public.sqlite` contains matching tables and a `record_sources` bridge for source queries. `economics-consultancy-public.zip` bundles the dataset, database, dictionary, this README and all CSV tables. The `csv` directory contains one export per data table; `csv-tables.zip` bundles the CSV tables. Nested arrays in CSV/SQLite cells are JSON strings. `field-dictionary.json` lists fields and their SQLite types. `checksums.json` records SHA-256 hashes for the downloads.

Financial values retain the reporting currency, period, entity and accounting basis. `value_exact` preserves the exact decimal value for calculations and `value` supports display. `is_latest` refers to the latest reporting period in the 24 July 2026 research extract for that firm. That selection includes 30 revenues, 29 operating profits, nine staff observations, four member counts and four member-profit pools. Blank values mark missing or non-comparable information. Staff definitions and the accounting treatment of member remuneration vary by firm.

Firm, organisation and legal-entity IDs are distinct. A null `firm_id` on a brand-level office or affiliation means no exact catalogue relationship has been supplied; matching by a similar name can incorrectly turn a global brand observation into a UK-company claim.

Source references give the original public URL, passage locator and recorded checking date. Person references concern selected professional statements, not every attribute of a biography. Appointment dates may be announcements, intended starts, actual starts or statutory dates. A blank end date does not establish that a person remains in the role.

Registered offices are legal addresses and may differ from working offices. International office/contact lists do not measure economic-consulting headcount or an exhaustive market footprint. The catalogue includes service lines, university institutes, groups, brands and legal entities; it is not a market census.

Example SQL:

```sql
SELECT f.name, v.year_end, v.currency, v.value_exact, v.accounting_basis
FROM financials v JOIN firms f ON f.id=v.firm_id
WHERE v.metric='turnover' AND v.is_latest=1;

SELECT p.name, a.organisation_name, a.role, a.date, a.date_basis
FROM affiliations a JOIN people p ON p.id=a.person_id;

SELECT r.table_name, r.record_id, s.url, r.locator, r.checked_on
FROM record_sources r JOIN sources s ON s.id=r.source_id;
```

## Financial filing provenance

All 140 public financial observations link to specific Companies House PDF pages. Each locator records the filing date, PDF page, printed page where present and the cited line or statement. The database page makes the 110-row financial register and 30-row revenue register available as separate CSV downloads. Comparative values point to the column in the cited filing. Baringa's estimate and both Fideres non-disclosures also have a second source page. If your PDF viewer ignores the page fragment, go to the PDF page in the locator.


## Career and event provenance

The 11 affiliation rows and 11 career event rows describe the same appointments. The event table also contains two statutory LLP appointments and two ownership events. The event date and announcement date are separate. A start can be recorded to month precision, and an intended start does not establish a first working day. Where a source is dated, the public provenance register gives its own publication or filing date as well as its locator. The two LLP forms link to PDF page 1. The exact filing links for all 140 financial observations are retained.


## Location provenance

The location register links each row to the original register, filing or issuer directory. Dates distinguish observation and review from filing, publication, replacement and dissolution. `in_latest_register_snapshot` describes the November register refresh. `included_in_latest_reader_selection` identifies the dated map selection. Both values are present to allow readers to reproduce the map or query the latest register.

The companion location CSV lists source URLs and dates, passage locators and PDF page references where available. The current Cambridge Econometrics contact page lists Cambridge and Northampton. The Brussels and Budapest rows record the earlier directory listing.


## Firm identity review

The Firms view gives the registered name and number as observed at Companies House on 14 November 2026. `organisations` carries register status, incorporation or establishment-opening date, and the source links for those fields. The `firm_identity_links` table links catalogue entries to their registered entities, UK legal context, group companies or university. The relation and source locators describe the scope of the evidence. The company and establishment numbers occupy separate fields. The E.CA overseas-company record also carries the German home register number. Individual engagements may identify a specific contracting entity.

A source date describes a filing, publication or event, as identified by its date basis. Every identity citation records its checking date. The separate [identity source register](../identity-provenance.csv) lists one row per catalogue link and supporting citation.


## People provenance

The `people` table includes an identity review status, review date, professional name variants and a count of checked affiliations. `people_affiliation_observations` gives each relationship, its role, the kind of evidence, the date and basis, and any recorded end date. Some rows give an observation date or preserve the month or year given by the original; some historical sources provide no role date. `record_sources` joins observations to their exact URLs, locators and source dates where supplied. An undated role or a missing end date does not establish current employment.

`people_alias_crosswalk` maps retired duplicate person IDs to a retained ID. The other public observations and event tables retain their existing scope. Unresolved identity entries stay visible; inherited affiliation claims without direct evidence remain in the research archive. See [People provenance](../people-provenance.html) for the review and [its source register](../people-provenance.csv) for the row-level citations.


## Ownership and acquisition provenance

Schema 1.4 adds `ownership_transactions` and `ownership_control_observations`. A transaction row records the correct perimeter (company, brand, group or practice), relevant stage, date precision and any supported terms. The control table contains point-in-time UK register entries, statutory bands, notifications and cessations. Read the date basis before comparing rows; a filing period end, a public announcement and a control notification do not establish the day of a closing. The previously released event table remains a small set of dated career and ownership examples. Use the Ownership tables for this review.

See the [ownership provenance notes](../ownership-provenance.html) and the [source register CSV](../ownership-provenance.csv) for original passages and filing pages. The joint Oxford Analytica and Dragonfly consideration applies to both businesses.


## Final provenance review

The [review notes](../final-provenance.html) and [change register](../final-provenance.csv) give the source and date added for each affected record. Brand and institution rows cite the original publisher. The alias crosswalk carries sources for both the professional and statutory names. Where available, accounts, career and ownership citations include filing or publication dates in `record_sources.source_date`. `date_basis` identifies the date type and `checked_on` records when the source was reviewed.
