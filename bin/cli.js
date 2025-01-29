#!/usr/bin/env node

const { createServer } = require('../dist/server');

const config = {
  baseUrl: process.env.BASE_URL,
  authToken: process.env.AUTH_TOKEN
};

createServer(config)
  .then(({ server, swaggerExplorer }) => {
    process.on('SIGTERM', async () => {
      console.log('Received SIGTERM. Shutting down gracefully...');
      await swaggerExplorer.stop();
      server.close();
    });

    process.on('SIGINT', async () => {
      console.log('Received SIGINT. Shutting down gracefully...');
      await swaggerExplorer.stop();
      server.close();
    });
  })
  .catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
