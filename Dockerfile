FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
    tini \
  && python3 -m pip install --no-cache-dir -U yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci --include=dev \
  && npm run build:frontend \
  && npm prune --omit=dev \
  && npm cache clean --force

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]