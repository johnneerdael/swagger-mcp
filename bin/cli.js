#!/usr/bin/env node

const { SwaggerExplorerMCP } = require('../dist');

const config = {
  baseUrl: process.env.BASE_URL,
  authToken: process.env.AUTH_TOKEN
  // Port will be automatically assigned
};

const mcp = new SwaggerExplorerMCP(config);

mcp.start()
  .then(port => {
    console.log(`MCP Server started successfully on port ${port}`);
  })
  .catch(error => {
    console.error('Failed to start MCP:', error);
    process.exit(1);
  });
