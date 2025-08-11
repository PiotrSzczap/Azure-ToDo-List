FROM mcr.microsoft.com/playwright:v1.54.2-jammy
WORKDIR /tests
COPY package*.json ./
RUN npm install
# Ensure no stale root spec (from previous layer cache) remains
RUN rm -f /tests/todo.spec.ts || true
# Copy only necessary test assets
COPY playwright.config.ts ./
COPY global-setup.ts ./
COPY tests ./tests
COPY tsconfig.json ./
CMD ["npm", "test"]
