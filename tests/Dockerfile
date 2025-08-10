FROM mcr.microsoft.com/playwright:v1.54.2-jammy
WORKDIR /tests
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "test"]
