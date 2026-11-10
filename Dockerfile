FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src/server.js ./src/server.js
COPY src/public ./src/public

# Fresh named volumes inherit this directory's ownership on first mount.
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('node:http'); const req = http.get({ host: '127.0.0.1', port: process.env.PORT || 3000, path: '/health' }, res => { res.resume(); process.exit(res.statusCode === 200 ? 0 : 1); }); req.setTimeout(3000, () => req.destroy(new Error('Health check timed out'))); req.on('error', () => process.exit(1));"

CMD ["npm", "start"]
