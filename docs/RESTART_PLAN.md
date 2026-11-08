# NIGHT AORI INTEL — restart architecture (2026-11-08)

## 最上位の基本理念（ユーザー確認：2026-11-08）
**広範囲の公開釣果情報を集め、正確に整理し、スマホで見やすく表示すること。**

機能優先順位：
1. 多元的な情報収集（エギCOM依存を下げ、ANGLERS、カンパリ、釣具店、遊漁船、公開ブログ等の到達可能なソースを増やす。アクセス制限は遵守する）
2. 地域・実釣日・岸/船・杯数・サイズ・釣法・出典を正規化し、重複・誤分類・推測値を排除する
3. 今日/昨日/7日・地域・地図/一覧・情報源リンクで直感的に閲覧できるUI
4. 風・波・水温・潮や予測はオプション。情報収集と閲覧を妨げたり、予測中心に転換したりしない

**受入評価は新たに検証済みの独立した情報源と表示の使いやすさを中心にする。** 釣行予測スコアの実装数は成功指標ではない。


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
