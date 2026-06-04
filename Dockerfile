FROM node:20-alpine AS builder

WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci

COPY client/package*.json client/
RUN cd client && npm ci

COPY shared/ shared/
COPY server/ server/
COPY client/ client/

RUN cd client && npm run build
RUN cd server && npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/server/dist/ ./server/dist/
COPY --from=builder /app/server/node_modules/ ./server/node_modules/
COPY --from=builder /app/client/dist/ ./client/dist/
COPY server/package.json ./server/

EXPOSE 2567
CMD ["node", "server/dist/index.js"]
