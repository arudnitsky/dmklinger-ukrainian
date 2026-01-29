# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy project files
COPY pyproject.toml .
COPY uv.lock* .

# Install dependencies using uv
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Copy application files
COPY server.py .
COPY index.html .
COPY index.js .
COPY index.css .
COPY index.json .
COPY words.json .
COPY word_dict.json .

# Expose port
EXPOSE 8000

# Run the FastAPI server
CMD ["uv", "run", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
