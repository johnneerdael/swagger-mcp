import express from 'express';
import { chromium } from 'playwright';
import yaml from 'yaml';

class SwaggerExplorerMCP {
  private app;
  private browser;
  private port;

  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    // Main API to explore Swagger
    this.app.post('/api/explore', async (req, res) => {
      try {
        const { url, options = {} } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        const result = await this.extractSwaggerInfo(url, options);
        res.json(result);
      } catch (error) {
        console.error('Error exploring Swagger:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get cached schemas
    this.app.get('/api/schemas', (req, res) => {
      // Implement schema caching if needed
      res.json({ message: 'Schema cache endpoint' });
    });
  }

  private async extractSwaggerInfo(url: string, options: {
    paths?: boolean;
    schemas?: boolean;
    methodFilter?: string[];
  }) {
    const page = await this.browser.newPage();
    let swaggerData = null;

    try {
      // Intercept network requests
      page.on('response', async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('swagger') || responseUrl.includes('openapi')) {
          try {
            swaggerData = await response.json();
          } catch (e) {
            const text = await response.text();
            if (text.includes('openapi:') || text.includes('swagger:')) {
              swaggerData = yaml.parse(text);
            }
          }
        }
      });

      await page.goto(url, { waitUntil: 'networkidle' });

      if (!swaggerData) {
        swaggerData = await page.evaluate(() => {
          // @ts-ignore
          return window.ui?.spec?.json;
        });
      }

      if (!swaggerData) {
        throw new Error('Could not find Swagger/OpenAPI specification');
      }

      const result: any = {};

      if (options.paths) {
        result.paths = Object.entries(swaggerData.paths || {})
          .filter(([_, methods]) => {
            if (!options.methodFilter) return true;
            return Object.keys(methods as object)
              .some(method => options.methodFilter.includes(method.toLowerCase()));
          })
          .map(([path, methods]) => ({
            path,
            methods: Object.keys(methods as object)
          }));
      }

      if (options.schemas) {
        const schemas = swaggerData.components?.schemas || 
                       swaggerData.definitions || {};
        result.schemas = Object.keys(schemas);
      }

      return result;
    } finally {
      await page.close();
    }
  }

  async start() {
    try {
      this.browser = await chromium.launch();
      this.app.listen(this.port, () => {
        console.log(`Swagger Explorer MCP running on port ${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start MCP:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
    }
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down gracefully...');
  if (global.mcp) {
    await global.mcp.stop();
  }
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down gracefully...');
  if (global.mcp) {
    await global.mcp.stop();
  }
});

// Start the MCP if this is the main module
if (require.main === module) {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const mcp = new SwaggerExplorerMCP(port);
  // @ts-ignore
  global.mcp = mcp;
  mcp.start();
}

export { SwaggerExplorerMCP };
