# Use Node.js 18 Alpine for smaller image size and better performance
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Health check to ensure container is running
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start the application
CMD ["npm", "start"]
```

Let me also create a simple healthcheck.js file:
<tool_call>file
<arg_key>path</arg_key>
<arg_value>the11-dev/healthcheck.js</arg_value>
<arg_key>mode</arg_key>
<arg_value>create</arg_value>
</tool_call>
