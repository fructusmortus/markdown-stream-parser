# Set Node.js version
ARG NODE_VERSION=23
ARG TREE_SITTER_VERSION=0.25.5
# Stage 1: Build
# FROM node:${NODE_VERSION}-alpine
# FROM frolvlad/alpine-glibc
FROM node:20-slim

# Install necessary packages
# RUN apk add --update --no-cache curl python3 make g++ gcc libc-dev

RUN apt-get update && apt-get install -y \
    xz-utils \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Download and install Node.js
# RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}.0.0/node-v${NODE_VERSION}.0.0-linux-x64.tar.xz | tar -xJ -C /usr/local --strip-components=1

ADD https://nodejs.org/dist/v23.0.0/node-v23.0.0-linux-x64.tar.gz /tmp/node.tar.gz
RUN tar -xzf /tmp/node.tar.gz -C /usr/local --strip-components=1 && rm /tmp/node.tar.gz

ADD https://github.com/tree-sitter/tree-sitter/releases/download/v0.25.5/tree-sitter-linux-x64.gz /tmp/tree-sitter.gz
RUN gzip -d /tmp/tree-sitter.gz \
    && chmod +x /tmp/tree-sitter \
    && mv /tmp/tree-sitter /usr/local/bin/tree-sitter \
    && tree-sitter --version

# Verify tree-sitter works
RUN tree-sitter --version

RUN npm install -g pnpm

# Set environment variables for C++ compilation
ENV CXXFLAGS="-std=c++20 -fexceptions"
ENV CXX="g++ -std=c++20 -fexceptions"
# Set the working directory
WORKDIR /usr/src/service

# Copy the rest of app's source code
COPY . .

# Install dependencies with exception handling enabled
RUN pnpm install --force && pnpm store prune && rm -rf ~/.pnpm-store
# Install dependencies
# CXXFLAGS="-fexceptions" added to make 
# RUN CXXFLAGS="-std=c++20 -fexceptions" pnpm install --force && pnpm store prune && rm -rf ~/.pnpm-store

# First ensure tsup is available at the root level
# RUN pnpm add -D tsup typescript ts-node @types/node

# Build the demo
# WORKDIR /usr/src/service/demo/svelte-demo
# RUN pnpm install --force
# # Install ts-node in the demo directory as well
# RUN pnpm add -D ts-node @types/node typescript
# RUN pnpm run build

WORKDIR /usr/src/service

# Run the application
CMD ["pnpm", "run", "start"]
