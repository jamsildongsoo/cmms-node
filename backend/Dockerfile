# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

# 비특권 사용자로 실행 (node 공식 이미지 내장 'node' 사용)
USER node

EXPOSE 8080
CMD ["node", "dist/main.js"]
