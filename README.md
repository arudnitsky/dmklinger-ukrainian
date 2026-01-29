# Ukrainian Dictionary

A fully searchable Ukrainian-to-English dictionary with inflection tables.

Made because I was a little annoyed by the dearth of resources for Ukrainian learners. All data scraped from Wiktionary and [dbnary](http://kaiko.getalp.org/about-dbnary/), which helpfully provides many definitions for words that do not have entries yet in Wiktionary. Forms filled in from [here](https://lcorp.ulif.org.ua/dictua/dictua.aspx), where a match was found.

**Frontend**: Hosted on GitHub Pages at https://dmklinger.github.io/ukrainian/

## API Reference

The server provides a REST API for programmatic dictionary lookups.

### `GET /api/lookup`

Look up words in the Ukrainian dictionary.

**Query Parameters:**

| Parameter | Type    | Default | Description                                                    |
| --------- | ------- | ------- | -------------------------------------------------------------- |
| `q`       | string  | -       | Search query. Use quotes for literal phrases: `"domestic cat"` |
| `filter`  | string  | -       | Part-of-speech filter (noun, verb, adjective, adverb, etc.)    |
| `sort`    | string  | `freq`  | Sort order: `freq`, `alpha`, or `alpha_rev`                    |
| `limit`   | integer | `100`   | Maximum results (1-10000)                                      |
| `exact`   | boolean | `true`  | If true, only return exact headword matches                    |

**Response:**

```json
{
  "data": [
    {
      "index": 12345,
      "word": "кіт",
      "pos": "noun",
      "info": "masculine",
      "defs": ["cat", "tomcat"],
      "freq": 5432,
      "forms": {
        "nom ns": ["кіт"],
        "nom np": ["коти"],
        "acc ns": ["кота"],
        ...
      }
    }
  ],
  "literalPhrases": null,
  "fuzzyWords": ["кіт"],
  "totalMatches": 1
}
```

**Examples:**

```bash
# Exact match search (default)
curl "http://localhost:8000/api/lookup?q=кіт"

# Fuzzy search
curl "http://localhost:8000/api/lookup?q=кіт&exact=false"

# Filter by part of speech
curl "http://localhost:8000/api/lookup?q=cat&filter=noun&exact=false"

# Sort alphabetically, limit results
curl "http://localhost:8000/api/lookup?q=при&sort=alpha&limit=10&exact=false"
```

**Error Responses:**

- `400 Bad Request`: Invalid `filter` or `sort` value (response includes valid options)

## Shell Script Usage

The `lookup.sh` script provides a convenient command-line interface:

```bash
# Basic usage (exact match, default)
./lookup.sh -q "кіт"

# Fuzzy search
./lookup.sh -q "кіт" --no-exact

# Filter by part of speech
./lookup.sh -q "cat" -f noun --no-exact

# Limit results and sort alphabetically
./lookup.sh -q "робити" -l 5 -s alpha --no-exact

# Use custom host
./lookup.sh -q "привіт" --host http://myserver:8000
```

**Options:**

| Flag           | Description                               |
| -------------- | ----------------------------------------- |
| `-q, --query`  | Search query (required)                   |
| `-f, --filter` | Part-of-speech filter                     |
| `-s, --sort`   | Sort order: freq, alpha, alpha_rev        |
| `-l, --limit`  | Maximum results (default: 100)            |
| `--no-exact`   | Disable exact match (enable fuzzy search) |
| `--host`       | API host (default: http://localhost:8000) |
| `-h, --help`   | Show help message                         |

## Docker Deployment

### Using Docker Compose (recommended)

```bash
# Build and start the server
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down
```

### Using Docker directly

```bash
# Build the image
docker build -t ukrainian-dictionary .

# Run the container
docker run -d -p 8000:8000 ukrainian-dictionary

# Stop the container
docker stop $(docker ps -q --filter ancestor=ukrainian-dictionary)
```

The server will be available at http://localhost:8000

## Development

This project uses [uv](https://docs.astral.sh/uv/) for Python package management.

### Setup

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Run development server with auto-reload
uv run uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### Regenerating Dictionary Data

To regenerate the dictionary data from source:

```bash
cd etl/
python main.py  # Takes several hours, requires ~4GB RAM
```

Output files (`words.json`, `index.json`, `word_dict.json`) are generated in `etl/data/` and should be copied to the project root.

## Data Sources

- [Wiktionary](https://en.wiktionary.org/) - Word definitions and forms
- [dbnary](http://kaiko.getalp.org/about-dbnary/) - Additional definitions from Wiktionary dumps
- [Ukrainian Linguistic Corpus](https://lcorp.ulif.org.ua/dictua/dictua.aspx) - Inflection tables

## License

Distributed under [Creative Commons Attribution-ShareAlike 3.0 Unported License](https://en.wikipedia.org/wiki/Wikipedia:Text_of_Creative_Commons_Attribution-ShareAlike_3.0_Unported_License) - feel free to reuse this data!

## Related Projects

If you are also interested in a Russian dictionary, see [this](https://github.com/dmklinger/russian) related project.
