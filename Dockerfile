# syntax=docker/dockerfile:1

FROM node:20-alpine AS backend-dev
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend ./
EXPOSE 4000
CMD ["npm", "run", "dev"]

FROM node:20-alpine AS frontend-dev
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend ./
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 4000
CMD ["node", "server.prod.js"]
