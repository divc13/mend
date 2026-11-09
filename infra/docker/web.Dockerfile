# syntax=docker/dockerfile:1.7
#
# Web image for the MEND npm workspace monorepo (Next.js app at apps/web).
#
# Build from the repository root:
#   docker build -f infra/docker/web.Dockerfile --target dev \
#     --build-arg MEND_WORKSPACE=@mend/web --build-arg MEND_APP_DIR=apps/web .
#
# The dev target is bind-mounted by docker-compose. The runtime target runs the
# workspace `build` then `start`. If the frontend adopts Next.js `output:
# "standalone"`, replace the runtime stage with the smaller standalone layout.

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

FROM base AS deps
COPY . .
RUN npm ci

FROM deps AS dev
ARG MEND_WORKSPACE=@mend/web
ARG MEND_APP_DIR=apps/web
ENV NODE_ENV=development \
    MEND_WORKSPACE=${MEND_WORKSPACE} \
    MEND_APP_DIR=${MEND_APP_DIR}

RUN chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["mend-run"]

FROM deps AS build
ARG MEND_WORKSPACE=@mend/web
ENV MEND_WORKSPACE=${MEND_WORKSPACE}
RUN npm run build --workspace "${MEND_WORKSPACE}" --if-present

FROM base AS runtime
ARG MEND_WORKSPACE=@mend/web
ARG MEND_APP_DIR=apps/web
ENV NODE_ENV=production \
    MEND_WORKSPACE=${MEND_WORKSPACE} \
    MEND_APP_DIR=${MEND_APP_DIR}

COPY --from=build /app /app
RUN chown -R node:node /app
USER node

EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["mend-run"]
