FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY backend/package.json backend/tsconfig.json backend/nest-cli.json ./backend/
COPY frontend/package.json ./frontend/package.json
COPY backend ./backend
RUN npm install
RUN npm run build --workspace backend

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.base.json ./
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=builder /app/backend/nest-cli.json ./backend/nest-cli.json
COPY --from=builder /app/backend/src ./backend/src
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace", "backend"]
