FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.base.json ./
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./frontend/
COPY backend/package.json ./backend/package.json
COPY frontend ./frontend
RUN npm install
RUN npm run build --workspace frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
