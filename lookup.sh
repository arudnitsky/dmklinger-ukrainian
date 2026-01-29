#!/bin/bash
#
# lookup.sh - Command-line interface for the Ukrainian Dictionary API
#
# Usage:
#   ./lookup.sh -q "кіт"              # Exact match search (default)
#   ./lookup.sh -q "кіт" --no-exact   # Fuzzy search
#   ./lookup.sh -q "cat" -f noun      # Filter by part of speech
#   ./lookup.sh -q "робити" -l 5      # Limit results
#   ./lookup.sh -q "слово" -s alpha   # Sort alphabetically
#
# Options:
#   -q, --query     Search query (required)
#   -f, --filter    Part-of-speech filter (noun, verb, adjective, etc.)
#   -s, --sort      Sort order: freq (default), alpha, alpha_rev
#   -l, --limit     Maximum results (default: 100)
#   --no-exact      Disable exact match mode (enable fuzzy search)
#   --host          API host (default: http://localhost:8000)
#   -h, --help      Show this help message
#
# Examples:
#   ./lookup.sh -q "кіт"
#   ./lookup.sh -q "cat" --filter noun --limit 10
#   ./lookup.sh -q "робити" --no-exact --sort alpha
#   ./lookup.sh -q "привіт" --host http://myserver:8000

set -e

# Default values
HOST="http://localhost:8000"
QUERY=""
FILTER=""
SORT="freq"
LIMIT="100"
EXACT="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -q|--query)
            QUERY="$2"
            shift 2
            ;;
        -f|--filter)
            FILTER="$2"
            shift 2
            ;;
        -s|--sort)
            SORT="$2"
            shift 2
            ;;
        -l|--limit)
            LIMIT="$2"
            shift 2
            ;;
        --no-exact)
            EXACT="false"
            shift
            ;;
        --host)
            HOST="$2"
            shift 2
            ;;
        -h|--help)
            head -n 27 "$0" | tail -n 25
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$QUERY" ]]; then
    echo "Error: Search query is required"
    echo "Usage: $0 -q <query> [options]"
    echo "Use --help for more information"
    exit 1
fi

# Build URL with query parameters
# URL-encode the query string for safe transmission
URL_ENCODED_QUERY=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$QUERY'''))")

URL="${HOST}/api/lookup?q=${URL_ENCODED_QUERY}&sort=${SORT}&limit=${LIMIT}&exact=${EXACT}"

# Add filter if specified
if [[ -n "$FILTER" ]]; then
    URL="${URL}&filter=${FILTER}"
fi

# Make API request
RESPONSE=$(curl -s -w "\n%{http_code}" "$URL")

# Extract HTTP status code (last line) and body (everything else)
HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

# Check for errors
if [[ "$HTTP_CODE" -ge 400 ]]; then
    echo "Error: API returned HTTP $HTTP_CODE"
    echo "$BODY"
    exit 1
fi

# Pretty print JSON output
if command -v jq &> /dev/null; then
    echo "$BODY" | jq .
else
    # Fallback: use Python for JSON formatting if jq not available
    echo "$BODY" | python3 -m json.tool
fi
