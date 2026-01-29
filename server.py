"""FastAPI server to safely serve the Ukrainian dictionary static site.

Provides:
- Static file serving for the frontend (HTML, CSS, JS, JSON data)
- /api/lookup endpoint for programmatic dictionary lookups
"""

import json
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent

# -----------------------------------------------------------------------------
# Data Loading at Startup
# -----------------------------------------------------------------------------

# Load dictionary data files
with open(BASE_DIR / "words.json", encoding="utf-8") as f:
    words_data: list[dict[str, Any]] = json.load(f)

with open(BASE_DIR / "index.json", encoding="utf-8") as f:
    index_data: dict[str, list] = json.load(f)

with open(BASE_DIR / "word_dict.json", encoding="utf-8") as f:
    word_dict_data: dict[str, list[int]] = json.load(f)

# Extract valid part-of-speech values dynamically from loaded data
VALID_POS: set[str] = {w["pos"] for w in words_data if w.get("pos")}

# Valid sort options
VALID_SORT_VALUES: set[str] = {"freq", "alpha", "alpha_rev"}

# -----------------------------------------------------------------------------
# Ukrainian Alphabetical Sorting
# -----------------------------------------------------------------------------

# Custom mapping for Ukrainian alphabetical order
# Maps Ukrainian letters to ASCII characters that sort in correct order
UKRAINIAN_SORT_MAP: dict[str, str] = {
    "а": "0", "б": "1", "в": "2", "г": "3", "ґ": "4", "д": "5",
    "е": "6", "є": "7", "ж": "8", "з": "9", "и": ":", "і": ";",
    "ї": "<", "й": "?", "к": "@", "л": "A", "м": "B", "н": "C",
    "о": "D", "п": "E", "р": "F", "с": "G", "т": "H", "у": "I",
    "ф": "K", "х": "L", "ц": "M", "ч": "N", "ш": "O", "щ": "P",
    "ь": "Q", "ю": "R", "я": "S",
}


def ukrainian_sort_key(word: str) -> str:
    """Generate sort key for Ukrainian alphabetical ordering.

    Removes stress marks (U+0301) and maps Ukrainian letters to ASCII
    characters that sort in the correct Ukrainian alphabetical order.
    """
    normalized = word.lower().replace("\u0301", "")
    return "".join(UKRAINIAN_SORT_MAP.get(c, c) for c in normalized)


# Pre-sort data for different sort orders
# Frequency sort: lower freq value = more common, nulls go last
freq_data: list[dict[str, Any]] = sorted(
    words_data,
    key=lambda w: (w.get("freq") is None, w.get("freq") or 0),
)

# Alphabetical sort: using Ukrainian letter ordering
alpha_data: list[dict[str, Any]] = sorted(
    words_data,
    key=lambda w: ukrainian_sort_key(w.get("word", "")),
)

# Build index lookup structure: term_id -> {word: str, indexes: set[int]}
index_lookup: dict[int, dict[str, Any]] = {}
for term_id_str, (term_word, word_indexes) in index_data.items():
    index_lookup[int(term_id_str)] = {
        "word": term_word,
        "indexes": set(word_indexes),
    }

# Convert word_dict to use sets for faster lookup
word_dict_sets: dict[str, set[int]] = {
    letter: set(term_ids) for letter, term_ids in word_dict_data.items()
}

# -----------------------------------------------------------------------------
# Helper Functions for Search
# -----------------------------------------------------------------------------


def normalize_letter(text: str) -> str:
    """Normalize Ukrainian letters for search matching.

    Converts ї→і and ґ→г for fuzzy matching.
    """
    return text.replace("ї", "і").replace("ґ", "г")


def unpack_forms(obj: Any) -> list[str]:
    """Recursively unpack nested form dictionaries into flat list of strings.

    Forms can be nested dicts (for verbs) or simple lists.
    Returns all string values found at any nesting level.
    """
    result: list[str] = []
    if isinstance(obj, dict):
        for value in obj.values():
            result.extend(unpack_forms(value))
    elif isinstance(obj, list):
        for item in obj:
            if isinstance(item, str):
                result.append(item)
            else:
                result.extend(unpack_forms(item))
    elif isinstance(obj, str):
        result.append(obj)
    return result


def remove_parentheticals(text: str) -> str:
    """Remove text within parentheses for definition matching.

    Example: "domestic cat (animal)" -> "domestic cat "
    """
    result = ""
    paren_depth = 0
    for char in text:
        if char == "(":
            paren_depth += 1
        elif char == ")":
            paren_depth -= 1
        elif paren_depth == 0:
            result += char
    return result


# -----------------------------------------------------------------------------
# Lookup Function (Python port of JavaScript lookupWords)
# -----------------------------------------------------------------------------


def lookup_words(
    search_query: str | None = None,
    pos_filter: str | None = None,
    sort: str = "freq",
    limit: int | None = 100,
    exact_match_only: bool = True,
) -> dict[str, Any]:
    """Look up words in the dictionary.

    This is a Python port of the JavaScript lookupWords() function.

    Args:
        search_query: Search string. Supports quoted "literal phrases" and
            fuzzy words. Example: '"domestic cat" animal' searches for exact
            phrase "domestic cat" AND fuzzy match on "animal".
        pos_filter: Part-of-speech filter (e.g., "noun", "verb", "adjective").
        sort: Sort order - "freq" (frequency), "alpha" (alphabetical),
            or "alpha_rev" (reverse alphabetical).
        limit: Maximum number of results to return. None for unlimited.
        exact_match_only: If True, only return words where headword exactly
            matches search query (ignoring stress marks and case).

    Returns:
        Dictionary with keys:
        - data: List of matching word objects
        - literalPhrases: Extracted quoted phrases (for highlighting)
        - fuzzyWords: Fuzzy search words (for highlighting)
        - totalMatches: Total matches before limit applied
    """
    # Select base dataset by sort order
    if sort == "freq":
        result_data = list(freq_data)
    elif sort == "alpha":
        result_data = list(alpha_data)
    elif sort == "alpha_rev":
        result_data = list(reversed(alpha_data))
    else:
        result_data = list(freq_data)

    # Apply part-of-speech filter
    if pos_filter:
        result_data = [w for w in result_data if w.get("pos") == pos_filter]

    # Track search highlighting data
    literal_phrases: list[str] | None = None
    fuzzy_words: list[str] | None = None

    # Apply search query
    if search_query and index_lookup and word_dict_sets:
        # Normalize search term: trim, collapse whitespace, lowercase
        normalized_search = re.sub(r"\s+", " ", search_query.strip().lower())

        # Extract literal phrases (text within double quotes)
        literal_matches = re.findall(r'"([^"]*)"', normalized_search)
        literal_phrases = list(literal_matches)

        # Extract individual words from literal phrases for index lookup
        literal_words: list[str] = []
        for phrase in literal_phrases:
            literal_words.extend(phrase.split())

        # Extract fuzzy words (text outside quotes)
        fuzzy_text = re.sub(r'"[^"]*"', "", normalized_search).strip()
        fuzzy_text = re.sub(r"\s+", " ", fuzzy_text)
        fuzzy_words = [w for w in fuzzy_text.split() if w]

        # Accumulated set of matching word indexes
        indexes: set[int] | None = None

        # Determine if substring matching allowed (canInclude)
        # True only if single fuzzy word with no Latin letters
        can_include = (
            len(fuzzy_words) == 1
            and not re.search(r"[a-z]", fuzzy_words[0])
        )

        # Process each fuzzy word (partial match at word start)
        for word in fuzzy_words:
            if not word:
                continue

            # Normalize: ї→і, ґ→г
            word = normalize_letter(word)

            # STEP 1: Find term IDs containing all letters in search word
            word_indexes: set[int] | None = None
            unique_letters = set(word)

            for letter in unique_letters:
                letter_terms = word_dict_sets.get(letter, set())
                if word_indexes is None:
                    word_indexes = set(letter_terms)
                else:
                    word_indexes = word_indexes & letter_terms

            if word_indexes is None:
                word_indexes = set()

            # STEP 2: Filter term IDs to those actually matching search word
            matching_term_ids: list[int] = []
            for term_id in word_indexes:
                if term_id not in index_lookup:
                    continue
                this_word = index_lookup[term_id]["word"]
                if can_include:
                    if word in this_word:
                        matching_term_ids.append(term_id)
                else:
                    if this_word.startswith(word) or this_word == word:
                        matching_term_ids.append(term_id)

            # Collect word indexes from matching terms
            new_indexes: set[int] = set()
            for term_id in matching_term_ids:
                new_indexes.update(index_lookup[term_id]["indexes"])

            # Intersect with accumulated indexes
            if indexes is None:
                indexes = new_indexes
            else:
                indexes = indexes & new_indexes

        # Process literal phrase words (exact match required)
        for word in literal_words:
            if not word:
                continue

            word = normalize_letter(word)

            # Find term IDs containing all letters
            word_indexes = None
            for letter in set(word):
                letter_terms = word_dict_sets.get(letter, set())
                if word_indexes is None:
                    word_indexes = set(letter_terms)
                else:
                    word_indexes = word_indexes & letter_terms

            if word_indexes is None:
                word_indexes = set()

            # Filter to exact matches only
            matching_term_ids = []
            for term_id in word_indexes:
                if term_id not in index_lookup:
                    continue
                this_word = index_lookup[term_id]["word"]
                if this_word == word:
                    matching_term_ids.append(term_id)

            # Collect word indexes
            new_indexes = set()
            for term_id in matching_term_ids:
                new_indexes.update(index_lookup[term_id]["indexes"])

            # Intersect with accumulated indexes
            if indexes is None:
                indexes = new_indexes
            else:
                indexes = indexes & new_indexes

        # LITERAL PHRASE VERIFICATION
        # Check that literal phrases appear as complete phrases in definitions/forms
        for literal_phrase in literal_phrases:
            if indexes is None:
                break

            # Get all candidate words
            candidate_data = [w for w in result_data if w["index"] in indexes]

            # Filter to words containing the literal phrase
            good_indexes: set[int] = set()
            normalized_phrase = normalize_letter(literal_phrase)

            for word_obj in candidate_data:
                # Check definitions (removing parentheticals)
                defs_match = False
                for defn in word_obj.get("defs", []):
                    cleaned_def = remove_parentheticals(defn).lower()
                    cleaned_def = normalize_letter(cleaned_def)
                    if normalized_phrase in cleaned_def:
                        defs_match = True
                        break

                # Check forms
                forms_match = False
                all_forms = unpack_forms(word_obj.get("forms", {}))
                for form in all_forms:
                    normalized_form = form.replace("\u0301", "")
                    normalized_form = normalize_letter(normalized_form.lower())
                    if normalized_form == normalized_phrase:
                        forms_match = True
                        break

                # Check headword
                headword = word_obj.get("word", "")
                normalized_headword = headword.replace("\u0301", "")
                normalized_headword = normalize_letter(normalized_headword.lower())
                headword_match = normalized_headword == normalized_phrase

                if defs_match or forms_match or headword_match:
                    good_indexes.add(word_obj["index"])

            indexes = indexes & good_indexes

        # Filter result data by matching indexes
        if indexes is not None:
            result_data = [w for w in result_data if w["index"] in indexes]

    # Apply exact match filter if enabled
    if exact_match_only and search_query:
        normalized_query = search_query.lower().replace("\u0301", "")
        result_data = [
            w for w in result_data
            if w.get("word", "").lower().replace("\u0301", "") == normalized_query
        ]

    # Calculate total before limiting
    total_matches = len(result_data)

    # Apply limit
    if limit is not None and limit > 0:
        result_data = result_data[:limit]

    return {
        "data": result_data,
        "literalPhrases": literal_phrases,
        "fuzzyWords": fuzzy_words,
        "totalMatches": total_matches,
    }


# -----------------------------------------------------------------------------
# Pydantic Response Models (camelCase for API consistency with JS frontend)
# -----------------------------------------------------------------------------


class LookupResponse(BaseModel):
    """Response model for /api/lookup endpoint."""

    data: list[dict[str, Any]] = Field(description="Array of matching word objects")
    literal_phrases: list[str] | None = Field(
        default=None,
        alias="literalPhrases",
        description="Extracted quoted search phrases",
    )
    fuzzy_words: list[str] | None = Field(
        default=None,
        alias="fuzzyWords",
        description="Fuzzy search words",
    )
    total_matches: int = Field(
        alias="totalMatches",
        description="Total matches before limit applied",
    )

    class Config:
        populate_by_name = True


# -----------------------------------------------------------------------------
# FastAPI Application
# -----------------------------------------------------------------------------

app = FastAPI(
    title="Ukrainian Dictionary",
    description="A Ukrainian-to-English dictionary with inflection tables",
)


@app.get("/")
async def root():
    """Serve the main index.html page."""
    return FileResponse(BASE_DIR / "index.html")


@app.get("/api/lookup", response_model=LookupResponse)
async def api_lookup(
    q: str | None = Query(default=None, description="Search query string"),
    filter: str | None = Query(
        default=None,
        description="Part-of-speech filter (e.g., noun, verb, adjective)",
    ),
    sort: str = Query(
        default="freq",
        description="Sort order: freq, alpha, or alpha_rev",
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=10000,
        description="Maximum results to return (1-10000)",
    ),
    exact: bool = Query(
        default=True,
        description="If true, only return exact headword matches",
    ),
) -> LookupResponse:
    """Look up words in the Ukrainian dictionary.

    Returns matching words with definitions, grammatical forms, and metadata.
    Supports fuzzy search, literal phrase matching, part-of-speech filtering,
    and multiple sort orders.

    Query parameters:
    - q: Search query. Use quotes for literal phrases: "domestic cat"
    - filter: Part-of-speech filter (noun, verb, adjective, etc.)
    - sort: Sort order - freq (default), alpha, alpha_rev
    - limit: Max results (default 100, max 10000)
    - exact: Require exact headword match (default true)
    """
    # Validate filter parameter
    if filter is not None and filter not in VALID_POS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid filter value '{filter}'. Valid values: {sorted(VALID_POS)}",
        )

    # Validate sort parameter
    if sort not in VALID_SORT_VALUES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort value '{sort}'. Valid values: {sorted(VALID_SORT_VALUES)}",
        )

    result = lookup_words(
        search_query=q,
        pos_filter=filter,
        sort=sort,
        limit=limit,
        exact_match_only=exact,
    )

    return LookupResponse(
        data=result["data"],
        literal_phrases=result["literalPhrases"],
        fuzzy_words=result["fuzzyWords"],
        total_matches=result["totalMatches"],
    )


# Mount static files for CSS, JS, and JSON data
# Note: This must come AFTER API routes to avoid path conflicts
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
