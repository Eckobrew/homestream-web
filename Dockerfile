# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_APP_NAME=HomeStream
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_CAST_RECEIVER_APP_ID
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL NEXT_PUBLIC_CAST_RECEIVER_APP_ID=$NEXT_PUBLIC_CAST_RECEIVER_APP_ID NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN --mount=type=secret,id=proxy_ca if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; npm ci && npm run build && npm cache clean --force
FROM node:22-alpine
WORKDIR /app
RUN addgroup -S -g 1001 homestream && adduser -S -u 1001 -G homestream homestream
COPY --from=build --chown=homestream:homestream /app/.next/standalone ./
COPY --from=build --chown=homestream:homestream /app/.next/static ./.next/static
COPY --from=build --chown=homestream:homestream /app/public ./public
USER homestream
ENV NODE_ENV=production PORT=3002 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3002/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
