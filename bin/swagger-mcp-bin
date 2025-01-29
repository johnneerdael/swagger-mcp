#!/usr/bin/env node

const { SwaggerExplorerMCP } = require('../dist');

const config = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || '',
  authToken: process.env.AUTH_TOKEN
};

const mcp = new SwaggerExplorerMCP(config);
mcp.start();
