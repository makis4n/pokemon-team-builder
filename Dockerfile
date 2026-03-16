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
