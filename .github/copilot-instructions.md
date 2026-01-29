# Ukrainian Dictionary Project

A static Ukrainian-to-English dictionary web app with inflection tables, scraped from Wiktionary and dbnary. Frontend hosted on GitHub Pages.

## Architecture

**Data Pipeline (ETL → Frontend)**

- `etl/main.py` orchestrates the pipeline: scrapes data → processes → generates JSON files
- Data flows: dbnary/Wiktionary APIs → `Dictionary` object → JSON files (`words.json`, `index.json`, `word_dict.json`)
- Frontend loads these pre-generated JSON files client-side (no backend server)

**Core Classes (etl/)**

- `Ontolex`: Parses dbnary TTL dump, extracts Ukrainian translations with glosses
- `Dictionary`: Main container, manages `Word` objects, handles accent merging, inflection lookups
- `Word`: Represents Ukrainian word, contains multiple `Usage` objects (one per part of speech)
- `Usage`: Stores definitions, grammatical forms, frequency data for a specific POS
- `Forms`: Manages declension/conjugation tables, removes duplicates, handles accent markers

**Frontend Architecture (Vanilla JS + D3.js)**

- Single-page app: `index.html` loads all data on startup, no pagination or lazy loading (except scrolling)
- `index.js` uses D3.js for data binding and DOM manipulation, not charts
- Search operates on pre-built indexes (`index.json`, `word_dict.json`) for fast client-side lookup
- Dynamic rendering: different table structures for nouns, verbs, adjectives based on available forms

## Key Patterns

**Accent Mark Handling**

- Ukrainian uses combining acute accent (U+0301 `́`) for stress
- Dictionary merges words with/without accents: `accentless_words` dict tracks variants
- `get_word_no_accent()` strips `́` for comparison
- Copy-to-clipboard removes accents unless "Copy Stress" checkbox is checked

**Search Features**

- Default search: fuzzy matching (finds words containing search term, normalizes ї→і, ґ→г)
- Exact match mode: checkbox filters results to only show words that exactly match the search term (ignoring stress marks and case)
- Search state persisted in URL with parameter `e=1` when exact match is enabled
- `exactMatchOnly` global variable tracks checkbox state
- Exact match filtering happens in `lookupWords()` function after index-based search

**Form Storage Conventions**

- Nouns: `nom ns/np` (nominative singular/plural), similar for all 7 cases (`acc`, `gen`, `dat`, `ins`, `loc`, `voc`)
- Single-form nouns: `nom n`, `acc n` (no number distinction)
- Adjectives: `nom am/an/af/ap` (male/neuter/female/plural), plus `addl comp/super/arg/adv`
- Verbs: nested structure `{tense: {person+number: [...], pp: {act/pas/adv/imp: [...]}}}`
- All forms stored as lists to handle multiple valid variants

**Caching Strategy**

- `data/wiktionary_raw_data.json` and `data/inflection_raw_data.json` cache API responses
- Set `use_cache=False` in `Ontolex()` or functions to force re-download
- Wiktionary throttling: use caches to avoid hitting rate limits during development

**Index Structure**

- `index.json`: Maps search terms → word IDs `{termId: [searchTerm, [wordIds]]}`
- `word_dict.json`: Maps first letter → term IDs for typeahead `{letter: [termIds]}`
- Search normalizes: `ї→і`, `ґ→г` for fuzzy matching

## Development Workflows

**Regenerating Dictionary Data**

```bash
cd etl/
python main.py  # Takes hours, requires ~4GB RAM
```

Output files land in `etl/data/` then copied to root (`words.json`, etc.)

**Testing Frontend Locally**
Open `index.html` in browser (no build step). Use browser DevTools to inspect `data`, `index`, `wordDict` globals.

**Adding New Data Sources**

1. Fetch raw data in `extract.py` (see `get_ontolex()`, `get_wiktionary_word()`)
2. Parse into `Word` objects with `add_definition()`, `add_forms()`
3. Add to `Dictionary` via `add_to_dictionary()`
4. Run cleanup: `clean_alerted_words()`, `garbage_collect()`, `add_frequencies()`

## Critical Implementation Notes

**Form Type Detection** (`index.js` lines 280-298)

- Checks presence of specific keys to determine table type: `'nom n'` → single noun, `'nom ns'` → regular noun, `'nom am'` → adjective, `'inf'` → verb
- Order matters: check single noun before regular noun

**Accent Priority** (`dictionary.py` Forms class)

- When merging forms, keeps version with most accents: `max(base_forms[f.replace("́", "")], f.count("́"))`
- Prevents unaccented forms from overwriting accented ones

**Definition Redundancy Removal** (`Usage.add_definition`)

- Auto-removes definitions contained in other definitions (ignoring parentheticals)
- Example: "cat" removed if "domestic cat" exists

**Memory Concerns**

- `words.json` is ~50MB, loads entirely in browser memory
- D3 data binding creates virtual DOM, scroll handler renders incrementally (`numDisplayed`)
- Don't add fields to word objects without considering multiplier effect

## Common Tasks

**Modify Table Rendering**: Edit `noun_table()`, `verb_table()`, `adjective_table()` in `index.js`

**Change Sorting**: Modify `alpha_data` sort key (lines 438-468), uses custom Cyrillic letter mapping

**Add Grammatical Features**: Extend `Forms` class, update frontend detection logic, add table columns

**Debug Data Issues**: Inspect `dictionary_data.json` (pretty-printed) in `etl/data/` before final dump
