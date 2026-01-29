"""FastAPI server to safely serve the Ukrainian dictionary static site."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI(
    title="Ukrainian Dictionary",
    description="A Ukrainian-to-English dictionary with inflection tables",
)

# Get the directory where this script is located
BASE_DIR = Path(__file__).resolve().parent


@app.get("/")
async def root():
    """Serve the main index.html page."""
    return FileResponse(BASE_DIR / "index.html")


# Mount static files for CSS, JS, and JSON data
app.mount("/", StaticFiles(directory=BASE_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
