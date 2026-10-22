FROM python:3.11-slim AS base

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY pyproject.toml ./
RUN uv sync --no-dev

FROM base AS runtime

COPY --from=builder /app/.venv /app/.venv
COPY server.py index.html index.js index.css index.json words.json word_dict.json ./

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]