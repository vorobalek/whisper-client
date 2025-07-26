# Use Node 20 base image
FROM node:20

# Install specific npm version
RUN npm install -g npm@11.5.1

# Set working directory to the mounted workspace
WORKDIR /workspaces/whisper-client

# Switch to the non-root user
USER node
