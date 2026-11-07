# NIGHT AORI INTEL — restart architecture (2026-11-08)

## Mission
Move from a single-site catch digest toward a **traceable shore-fishing decision assistant** for Echizen, Tsuruga, Wakasa, Maizuru and Tango. A catch post is **not** a probability sample. No "chance to catch" percentage without calibrated independent evidence.

## Review roles (AI workflow, not invited human collaborators)
1. PM/technical lead — staged delivery and rollback
2. Data intake — diversify verified firsthand reporting; detect blocked feeds
3. Data quality — validate species, time, shore/boat, counts and cross-posted sessions
4. Fishing analytics — observed vs forecast conditions and uncertainty
5. Mobile UX — Android usability and evidence visibility
6. QA/security — reproducible tests; no API keys in frontend

## Baseline
2026-11-08 data/catches.json: 746 total records, 671 Yamaria/EgiCOM; 628 shore sessions, 621 EgiCOM. Non-EgiCOM shore is only 7/628. Bing RSS fallback had 50 raw results but zero relevant accepted results. A Brave API key is currently not configured. The existing single source dominates the shore view.

## Sprint 1 on a new branch
- Add another shop source that publicly publishes Aori catches: Johshuya Shinfukui (`s=60`).
- Shop parser must not label Kanazawa offshore or other-prefecture catches as Echizen shore.
- Display 7-day independent shore evidence coverage and distinguish missing data from zero catches.
- Make search rejection reasons observable for diagnosis.
- Run syntax and regression tests on PR; do not merge before CI and a live Actions collection confirm working extraction.

## Sprint 2 (not implemented here)
- Test other verified shore publishers (local tackle shops/blogs) **from GitHub Actions**, not only browsers/search-index snippets. Keep detailed source-health state.
- Capture primary date, actual fishing date, precise/area-only location, method, individual/boat catch basis and provenance; deduplicate syndication.
- Separate marine observation and forecast in a weather feed with timestamps and source attribution; a `missing` value is not a favorable signal.
- Design risk-gated, explainable shore ranking with wind exposure, surf conditions, observation age, catch-evidence freshness and uncertainty. Start with comparative labels, not invented catch percentages.

## Release gates
1. Run `npm run validate` and review CI result.
2. Verify a real collector run on the new code: Shinfukui status is `ok` or an explicit block/error; parse must never silently pass unrelated data as fresh.
3. Compare before/after source distribution. Do not call added source "success" without a new verified shore record.
4. Manually inspect phone UI and a few representative source links; fallback if any field is empty.
5. Merge PR only after explicit review. The existing GitHub Pages main stays intact until then.
