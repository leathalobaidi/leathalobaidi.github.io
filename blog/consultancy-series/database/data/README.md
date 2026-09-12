# Economics consultancy catalogue

Updated 12 September 2026. This download contains 90 firm catalogue entries and 241 professional or research person entries. A record is not a complete or verified biography.

The download includes 140 individually checked financial field observations, including comparative years and two explicit non-disclosures; 11 appointment/advisory relationships; 15 dated events; 81 dated registered-office observations; and 109 office/contact-city observations across ten international firms. Eighty registered-address observations form the latest reader selection. A dated observation can be historical even when it is the latest available record.

`public-data.json` contains the full public dataset. `economics-consultancy-public.sqlite` contains matching tables and a `record_sources` bridge for source queries. `economics-consultancy-public.zip` bundles the dataset, database, dictionary, this README and all CSV tables. The `csv` directory contains one export per data table; `csv-tables.zip` bundles all nine CSVs. Nested arrays in CSV/SQLite cells are JSON strings. `field-dictionary.json` lists fields and their SQLite types. `checksums.json` records SHA-256 hashes for the downloads.

Financial values retain the reporting currency, period, entity and accounting basis. `value_exact` preserves the exact decimal value; `value` is convenient for display. `is_latest` selects the latest reporting period in the research catalogue for that firm. The latest supported values include 30 revenues, 29 operating profits, nine staff observations, four member counts and four member-profit pools. A blank is not zero, staff definitions differ, and member profit is not necessarily cash pay.

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
