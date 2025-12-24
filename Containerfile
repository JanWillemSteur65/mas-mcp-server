############################
# 1) Build stage (pnpm)
############################
FROM registry.access.redhat.com/ubi9/nodejs-20 AS build
WORKDIR /opt/app-root/src

COPY package.json pnpm-workspace.yaml ./
COPY packages ./packages
COPY scripts ./scripts
COPY .npmrc ./

USER 0
RUN chmod -R g=u /opt/app-root/src
USER 1001

RUN npm install -g pnpm@9.15.4
RUN pnpm install --frozen-lockfile=false

RUN pnpm -C packages/server run build
RUN pnpm -C packages/ui run build

############################
# 2) Runtime stage (npm, always-works)
############################
FROM registry.access.redhat.com/ubi9/nodejs-20-minimal
ENV NODE_ENV=production
WORKDIR /opt/app-root/src

USER 1001
RUN mkdir -p /opt/app-root/src/server /opt/app-root/src/ui /opt/app-root/src/data

COPY --from=build /opt/app-root/src/packages/server/dist /opt/app-root/src/server/dist
COPY --from=build /opt/app-root/src/packages/server/package.json /opt/app-root/src/server/package.json

WORKDIR /opt/app-root/src/server
RUN npm install --omit=dev --no-audit --no-fund

WORKDIR /opt/app-root/src
COPY --from=build /opt/app-root/src/packages/ui/dist /opt/app-root/src/ui/dist

EXPOSE 8080
ENV PORT=8080

ENV TENANTS_FILE=/opt/app-root/src/data/tenants.json
ENV CONFIG_WRITE_ENABLED=false
ENV ADMIN_TOKEN=

CMD ["node", "server/dist/index.js"]
