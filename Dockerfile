# Dockerfile for O2U Mobile App Development Environment
# This runs the Expo development server in a container

FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose Expo ports
# 8081 - Metro bundler
# 19000 - Expo DevTools (legacy)
# 19001 - Expo DevTools (legacy)
# 19002 - Expo DevTools (legacy)
# 19006 - Expo web server
EXPOSE 8081 19000 19001 19002 19006

# Set environment to development
ENV NODE_ENV=development

# Default command - start Expo development server
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
