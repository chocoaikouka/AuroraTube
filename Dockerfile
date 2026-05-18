FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    python3-venv \
    ca-certificates \
    tini \
  && python3 -m venv "$VIRTUAL_ENV" \
  && pip install --no-cache-dir -U pip yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm install --include=dev \
  && npm run build:frontend \
  && npm prune --omit=dev \
  && npm cache clean --force

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
