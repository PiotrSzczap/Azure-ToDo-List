############################
# Build Stage
############################
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
COPY . .
RUN npm run build:prod

############################
# Runtime Stage (Nginx)
############################
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist/azure-todo-frontend/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -q -O - http://localhost/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
