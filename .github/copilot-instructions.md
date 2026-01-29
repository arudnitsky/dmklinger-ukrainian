# Ukrainian Dictionary Project

A Ukrainian-to-English dictionary web app with inflection tables, scraped from Wiktionary and dbnary. Can run as static frontend on GitHub Pages or with FastAPI backend for API access.

## Architecture

**Data Pipeline (ETL → Frontend/API)**

- `etl/main.py` orchestrates the pipeline: scrapes data → processes → generates JSON files
- Data flows: dbnary/Wiktionary APIs → `Dictionary` object → JSON files (`words.json`, `index.json`, `word_dict.json`)
- Output files used both by frontend (static JSON) and backend API (loaded at startup)

**Core Classes (etl/)**

- `Ontolex`: Parses dbnary TTL dump, extracts Ukrainian translations with glosses
- `Ontolex_Word`: Intermediate representation for translations from dbnary data
- `Dictionary`: Main container, manages `Word` objects, handles accent merging, inflection lookups
- `Word`: Represents Ukrainian word, contains multiple `Usage` objects (one per part of speech)
- `Usage`: Stores definitions, grammatical forms, frequency data for a specific POS
- `Forms`: Manages declension/conjugation tables, removes duplicates, handles accent markers

**Frontend Architecture (Vanilla JS + D3.js)**

- Single-page app: `index.html` loads all data on startup (~50MB), no pagination or lazy loading (except infinite scroll)
- `index.js` uses D3.js for data binding and DOM manipulation, not charts
- Search operates on pre-built indexes (`index.json`, `word_dict.json`) for fast client-side lookup
- `lookupWords()` is the core lookup function—encapsulates all search, filter, sort logic
- Dynamic table rendering: detects form type (noun/verb/adjective) by checking presence of specific keys
- Thoroughly documented with JSDoc comments on all functions

**Backend API (FastAPI)**

- `server.py` provides optional FastAPI server with `/api/lookup` endpoint
- Loads same JSON files at startup, mirrors frontend `lookupWords()` logic in Python
- Enables programmatic dictionary access without browser
- Run with: `python server.py` or `uvicorn server:app`
- Docker support via `Dockerfile` and `docker-compose.yml`

## Key Patterns

**Accent Mark Handling**

- Ukrainian uses combining acute accent (U+0301 `́`) for stress
- Dictionary merges words with/without accents: `accentless_words` dict tracks variants
- `get_word_no_accent()` strips `́` for comparison
- Copy-to-clipboard removes accents unless "Copy Stress" checkbox is checked
- When merging forms, keeps version with most accents (prevents unaccented from overwriting accented)

**Search Features**

- Default search: fuzzy prefix matching (words starting with search term)
- Quoted phrases: `"literal phrase"` requires exact phrase match in definitions/forms
- Letter normalization: `ї→і`, `ґ→г` for Ukrainian keyboard variants
- Exact match mode: checkbox (`#exactMatch`) filters results to only exact headword matches
- Search highlighting: wraps matches in `<span class="highlight">` after rendering
- URL persistence: search state saved as `q=`, `f=`, `s=`, `e=1` parameters

**Form Storage Conventions**

- Nouns: `nom ns/np` (nominative singular/plural), similar for all 7 cases (`acc`, `gen`, `dat`, `ins`, `loc`, `voc`)
- Single-form nouns: `nom n`, `acc n` (no number distinction)
- Adjectives: `nom am/an/af/ap` (male/neuter/female/plural), plus `addl comp/super/arg/adv`
- Verbs: nested structure `{tense: {person+number: [...], pp: {act/pas/adv/imp: [...]}}}`
- All forms stored as lists to handle multiple valid variants

**Caching Strategy**

- `etl/data/wiktionary_raw_data.json` and `etl/data/inflection_raw_data.json` cache API responses
- `etl/data/ontolex_data.json` caches parsed dbnary data
- `etl/data/raw_dbnary_dump.ttl` caches decompressed dbnary dump
- Set `use_cache=False` in `Ontolex()` or functions to force re-download

**Index Structure**

- `index.json`: Maps term IDs → `[searchTerm, [wordIds]]`
- `word_dict.json`: Maps first letter → `[termIds]` for fast letter-based filtering
- Both converted to Sets at runtime for O(1) lookup

## API Reference

**GET /api/lookup**

Query parameters:

- `q`: Search query string (supports quoted phrases)
- `filter`: Part-of-speech filter (noun, verb, adjective, adverb, pronoun, numeral, particle, phrase, proverb, symbol)
- `sort`: Sort order—`freq` (default), `alpha`, `alpha_rev`
- `limit`: Max results (default 100, max 10000)
- `exact`: Require exact headword match (default true)

Response:

```json
{
  "data": [...],           // Array of word objects
  "literalPhrases": [...], // Extracted quoted phrases
  "fuzzyWords": [...],     // Fuzzy search terms
  "totalMatches": 42       // Total before limit
}
```

## Development Workflows

**Running Locally (Static)**

Open `index.html` directly in browser. Use DevTools to inspect globals: `data`, `index`, `wordDict`, `freq_data`, `alpha_data`.

**Running with API Server**

```bash
python server.py  # Runs on http://localhost:8000
# Or with Docker:
docker-compose up
```

**Regenerating Dictionary Data**

```bash
cd etl/
python main.py  # Takes hours, requires ~4GB RAM
```

Output files land in `etl/data/` and are copied to project root (`words.json`, `index.json`, `word_dict.json`).

**Adding New Data Sources**

1. Fetch raw data in `extract.py` (see `get_ontolex()`, `get_wiktionary_word()`)
2. Parse into `Word` objects with `add_definition()`, `add_forms()`
3. Add to `Dictionary` via `add_to_dictionary()`
4. Pipeline runs: `clean_alerted_words()` → `garbage_collect()` → `add_frequencies()` → `get_inflections()`

## Critical Implementation Notes

**Form Type Detection** (`index.js` lines ~555-575)

- Checks presence of specific keys to determine table type:
  - `'nom n'` or `'acc n'` → single noun table
  - `'nom ns'` or `'nom np'` → regular noun table (singular/plural)
  - `'nom am'`, `'nom af'`, `'nom an'`, or `'nom ap'` → adjective table
  - `'inf'` → verb table
- Order matters: check single noun before regular noun

**Ukrainian Alphabetical Sort**

- Custom sort key maps Ukrainian letters to ASCII for correct ordering
- Order: а б в г ґ д е є ж з и і ї й к л м н о п р с т у ф х ц ч ш щ ь ю я
- Stress marks (`U+0301`) stripped before sorting

**Definition Redundancy Removal** (`Usage.add_definition`)

- Auto-removes definitions contained in other definitions (ignoring parentheticals)
- Example: "cat" removed if "domestic cat" exists

**Memory Concerns**

- `words.json` is ~50MB, loads entirely in browser/server memory
- D3 data binding, scroll handler renders incrementally (`numDisplayed`)
- Backend pre-sorts data at startup (`freq_data`, `alpha_data`) for fast response

## Common Tasks

**Modify Table Rendering**: Edit `single_noun_table()`, `noun_table()`, `verb_table()`, `adjective_table()` in `index.js`

**Change Sorting**: Modify `UKRAINIAN_SORT_MAP` in `server.py` or the inline object in `index.js` (~lines 850-930)

**Add API Endpoint**: Add route in `server.py`, follow existing `lookup_words()` pattern

**Add Frontend Feature**: Update `lookupWords()` for data logic, update UI handlers (`search()`, `filter()`, `select()`)

**Debug Data Issues**: Inspect `etl/data/dictionary_data.json` (pretty-printed) before final dump
