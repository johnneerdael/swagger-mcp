import { createServer } from 'net';

async function findAvailablePort(startPort: number = 3000, endPort: number = 65535): Promise<number> {
  for (let port = startPort; port <= endPort; port++) {
    try {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            resolve(false);
          } else {
            reject(err);
          }
        });
        server.once('listening', () => {
          server.close();
          resolve(true);
        });
        server.listen(port);
      });
      return port;
    } catch (err) {
      continue;
    }
  }
  throw new Error('No available ports found');
}

// Update the start method in SwaggerExplorerMCP class
async start() {
  try {
    this.browser = await chromium.launch();
    const port = this.config.port || await findAvailablePort();
    
    return new Promise((resolve, reject) => {
      this.app.listen(port)
        .once('listening', () => {
          console.log(`Swagger Explorer MCP running on port ${port}`);
          if (this.config.baseUrl) {
            console.log(`Base URL: ${this.config.baseUrl}`);
          }
          if (this.config.authToken) {
            console.log('Authentication enabled');
          }
          resolve(port);
        })
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying another port...`);
            this.config.port = undefined; // Reset port to try again
            this.start().then(resolve).catch(reject);
          } else {
            console.error('Failed to start MCP:', err);
            reject(err);
          }
        });
    });
  } catch (error) {
    console.error('Failed to start MCP:', error);
    process.exit(1);
  }
}