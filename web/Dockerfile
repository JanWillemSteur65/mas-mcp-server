FROM node:20-alpine AS build
WORKDIR /src
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.25-alpine
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Optional: set API base via env by replacing at runtime; for simplicity, use same-origin /api.
EXPOSE 8080
