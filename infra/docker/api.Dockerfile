# syntax=docker/dockerfile:1.7
#
# Generic API / worker image for the MEND npm workspace monorepo.
# The same image is used by the api and indexer services; the workspace and app
# directory are selected through build args and environment variables.
#
# Build from the repository root:
#   docker build -f infra/docker/api.Dockerfile --target dev \
#     --build-arg MEND_WORKSPACE=@mend/api --build-arg MEND_APP_DIR=apps/api .
#
# Notes
# - The build context is the repo root so npm workspaces resolve correctly.
# - Node 22 is the default; pass --build-arg NODE_VERSION=26 to opt in to 26.
# - The container runs as the unprivileged `node` user (uid 1000).
# - A root .dockerignore is required for fast/safe builds; see
#   infra/docker/dockerignore.template.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates dumb-init \
 && rm -rf /var/lib/apt/lists/*

COPY infra/docker/run-workspace.sh /usr/local/bin/mend-run
RUN chmod 0755 /usr/local/bin/mend-run

# ---------------------------------------------------------------------------
# Dependencies. `COPY . .` keeps the image buildable before every workspace
# exists; the root .dockerignore keeps node_modules and secrets out of the
# context. Once the monorepo is complete this can be narrowed for layer caching.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY . .
RUN npm ci

# ---------------------------------------------------------------------------
# Development target: source is bind-mounted by docker-compose, dependencies
# come from the image. Runs `npm run dev` (or start) for the selected workspace.
# ---------------------------------------------------------------------------
FROM deps AS dev
ARG MEND_WORKSPACE=@mend/api
ARG MEND_APP_DIR=apps/api
ENV NODE_ENV=development \
    MEND_WORKSPACE=${MEND_WORKSPACE} \
    MEND_APP_DIR=${MEND_APP_DIR}

RUN chown -R node:node /app
USER node

EXPOSE 4000 4100
ENTRYPOINT ["dumb-init", "--"]
CMD ["mend-run"]

# ---------------------------------------------------------------------------
# Production target: build the selected workspace, then run it as non-root.
# ---------------------------------------------------------------------------
FROM deps AS build
ARG MEND_WORKSPACE=@mend/api
ENV MEND_WORKSPACE=${MEND_WORKSPACE}
RUN npm run build --workspace "${MEND_WORKSPACE}" --if-present

FROM base AS runtime
ARG MEND_WORKSPACE=@mend/api
ARG MEND_APP_DIR=apps/api
ENV NODE_ENV=production \
    MEND_WORKSPACE=${MEND_WORKSPACE} \
    MEND_APP_DIR=${MEND_APP_DIR}

COPY --from=build /app /app
RUN chown -R node:node /app
USER node

EXPOSE 4000 4100
ENTRYPOINT ["dumb-init", "--"]
CMD ["mend-run"]
