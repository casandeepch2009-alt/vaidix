FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /agent

COPY requirements.txt /agent/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Build-time import smoke. Fails the image build if any agent-critical import
# can't resolve — catches missing transitive deps (e.g. PyAV regressions) HERE,
# instead of in a runtime crash loop after deploy.
RUN python -c "import av; from livekit.agents import JobContext; print('agent imports OK')"

COPY main.py /agent/main.py

# `start` is the livekit-agents subcommand that runs the worker forever and
# registers it with the LiveKit server for auto-dispatch on every new room.
CMD ["python", "main.py", "start"]
