FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build client then server
RUN npm run build

EXPOSE 2567

CMD ["npm", "start"]
