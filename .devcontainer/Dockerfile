# Use Node 20 base image
FROM node:20

# Install specific npm version
RUN npm install -g npm@11.4.2

# Set working directory to the mounted workspace
WORKDIR /workspaces/whisper-frontend

# Switch to the non-root user
USER node
