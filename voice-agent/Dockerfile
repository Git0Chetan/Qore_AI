# LiveKit voice/video agent worker (proctoring, AI interview, Career Buddy).
# Runs as a long-lived worker that connects to LiveKit Cloud and waits for jobs.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim

WORKDIR /app

# Runtime libs: ffmpeg for audio, libgomp1 for onnxruntime (silero/turn-detector).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates ffmpeg libgomp1 \
  && rm -rf /var/lib/apt/lists/*

# Resolve & install Python deps first (better layer caching).
# Not --frozen: the lock predates the anam plugin addition, so allow a re-resolve.
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev

# App code.
COPY . .

# Pre-download model files (silero VAD, turn detector) so first job isn't slow.
RUN uv run python agent.py download-files || true

ENV PYTHONUNBUFFERED=1

# Production worker mode (registers with LiveKit and processes jobs). No HTTP port.
CMD ["uv", "run", "python", "agent.py", "start"]
