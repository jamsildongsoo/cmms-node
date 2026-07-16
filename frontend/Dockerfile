# 빌드 컨텍스트 = 레포 루트 (docker/nginx/prod.conf 접근 위해). docker-compose.prod.yml 참조.
# ===== build =====
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# gzip_static용 사전 압축(.gz). 빌드 시 1회 -9 최고압축 → 런타임 CPU 0.
# gzip -c 리다이렉트로 원본 보존(busybox/GNU 모두 호환).
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.svg' -o -name '*.json' \) \
    -exec sh -c 'gzip -9 -c "$1" > "$1.gz"' _ {} \;

# ===== serve (nginx + 정적 React) =====
FROM nginxinc/nginx-unprivileged:1.25-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker/nginx/prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
