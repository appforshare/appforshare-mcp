# AppForShare MCP server (stdio). Set APPFORSHARE_TOKEN (create one at https://appforshare.io/dashboard/settings).
FROM node:22-slim
WORKDIR /app
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --ignore-scripts --no-audit --no-fund && npm run build && npm prune --omit=dev
ENV NODE_ENV=production
ENTRYPOINT ["node", "dist/server.js"]
