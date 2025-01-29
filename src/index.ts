import express, { Request, Response } from 'express';
import { chromium, Browser, Page } from 'playwright';
import yaml from 'yaml';
import { createServer } from 'net';

declare global {
  var mcp: SwaggerExplorerMCP;
}

interface SwaggerExplorerConfig {
  baseUrl?: string;
  authToken?: string;
  port?: number;
}

interface SwaggerOptions {
  paths?: boolean;
  schemas?: boolean;
  methodFilter?: string[];
}

interface ResponseFormat {
  contentType: string;
  schema: any;
  example?: any;
  encoding?: any;
}

interface PathResponse {
  code: string;
  description: string;
  formats: ResponseFormat[];
}

interface SchemaProperty {
  type?: string;
  format?: string;
  description?: string;
  required?: boolean;
  enum?: unknown[];
  items?: {
    type?: string;
    $ref?: string;
  };
  $ref?: string;
}

interface SchemaDetails {
  type: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
  description?: string;
  example?: any;
  responses?: PathResponse[];
}

class SwaggerExplorerMCP {
  private app;
  private browser!: Browser;
  private config: SwaggerExplorerConfig;
  private schemaCache: Map<string, any>;
  private port?: number;

  constructor(config: SwaggerExplorerConfig = {}) {
    this.config = {
      ...config
    };
    this.app = express();
    this.schemaCache = new Map();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    
    // Authentication middleware
    const authMiddleware = (req: Request, res: Response, next: express.NextFunction) => {
      const authHeader = req.headers.authorization;
      
      if (!this.config.authToken) {
        return next();
      }

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.split(' ')[1];
      if (token !== this.config.authToken) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      next();
    };

    // Apply auth middleware to all routes except health
    this.app.use((req, res, next) => {
      if (req.path === '/health') {
        return next();
      }
      authMiddleware(req, res, next);
    });
  }

  private setupRoutes() {
    const basePath = this.config.baseUrl || '';
    
    // Custom response format handler
    const formatResponse = (data: unknown, format?: string) => {
      switch (format?.toLowerCase()) {
        case 'minimal':
          return {
            status: 'success',
            data: this.minimizeResponse(data)
          };
        case 'detailed':
          return {
            status: 'success',
            timestamp: new Date().toISOString(),
            data,
            metadata: {
              version: '1.0',
              format: 'detailed'
            }
          };
        default:
          return data;
      }
    };

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy' });
    });

    // Main API to explore Swagger
    this.app.post(`${basePath}/api/explore`, async (req, res) => {
      try {
        const { url, options = {} } = req.body;
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        const page = await this.browser.newPage();
        try {
          const swaggerData = await this.getSwaggerData(url, page);
          const result = await this.processSwaggerData(swaggerData, options as SwaggerOptions);
          res.json(formatResponse(result, req.body.format));
        } finally {
          await page.close();
        }
      } catch (error) {
        console.error('Error exploring Swagger:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Get response schemas for a path
    this.app.post(`${basePath}/api/response-schemas`, async (req, res) => {
      try {
        const { url, path, method, format } = req.body;
        if (!url || !path || !method) {
          return res.status(400).json({ error: 'URL, path, and method are required' });
        }

        const page = await this.browser.newPage();
        try {
          const swaggerData = await this.getSwaggerData(url, page);
          const responses = await this.extractResponseSchemas(swaggerData, path, method);
          res.json(formatResponse(responses, format));
        } finally {
          await page.close();
        }
      } catch (error) {
        console.error('Error getting response schemas:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });
  }

  private minimizeResponse(data: unknown): unknown {
    if (Array.isArray(data)) {
      return data.map(item => this.minimizeResponse(item));
    }
    if (typeof data === 'object' && data !== null) {
      const minimized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== null && value !== undefined && value !== '') {
          minimized[key] = this.minimizeResponse(value);
        }
      }
      return minimized;
    }
    return data;
  }

  private async processSwaggerData(swaggerData: any, options: SwaggerOptions) {
    const result: any = {};

    if (options.paths) {
      result.paths = Object.entries(swaggerData.paths || {})
        .filter(([_, methods]) => {
          if (!options.methodFilter?.length) return true;
          const methodKeys = Object.keys(methods as object);
          return methodKeys.some(method => 
            options.methodFilter?.includes(method.toLowerCase()) ?? false);
        })
        .map(([path, methods]) => ({
          path,
          methods: Object.keys(methods as object)
        }));
    }

    if (options.schemas) {
      const schemas = swaggerData.components?.schemas || swaggerData.definitions || {};
      result.schemas = Object.keys(schemas);
    }

    return result;
  }

  private async extractResponseSchemas(swaggerData: any, path: string, method: string): Promise<PathResponse[]> {
    const responses = swaggerData.paths[path]?.[method]?.responses || {};
    return Object.entries(responses).map(([code, response]: [string, any]) => ({
      code,
      description: response.description || '',
      formats: Object.entries(response.content || {}).map(([contentType, content]: [string, any]) => ({
        contentType,
        schema: content.schema,
        example: content.example,
        encoding: content.encoding
      }))
    }));
  }

  async start(): Promise<number> {
    try {
      this.browser = await chromium.launch();
      
      // Find an available port if none is specified
      if (!this.port) {
        this.port = await findAvailablePort();
      }
      
      return new Promise((resolve, reject) => {
        const server = this.app.listen(this.port)
          .once('listening', () => {
            console.log(`Swagger Explorer MCP running on port ${this.port}`);
            if (this.config.baseUrl) {
              console.log(`Base URL: ${this.config.baseUrl}`);
            }
            if (this.config.authToken) {
              console.log('Authentication enabled');
            }
            resolve(this.port!);
          })
          .once('error', async (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              console.log(`Port ${this.port} in use, trying another port...`);
              this.port = undefined; // Reset port to try again
              try {
                const newPort = await this.start();
                resolve(newPort);
              } catch (retryError) {
                reject(retryError);
              }
            } else {
              console.error('Failed to start MCP:', err);
              reject(err);
            }
          });

        // Store server reference for proper shutdown
        this.server = server;
      });
    } catch (error) {
      console.error('Failed to start MCP:', error);
      throw error;
    }
  }

  async stop() {
    if (this.browser) {
      await this.browser.close();
    }
    if (this.server) {
      await new Promise((resolve) => this.server.close(resolve));
    }
    process.exit(0);
  }
  private async getSwaggerData(url: string, page: Page): Promise<any> {
    let swaggerData = null;

    // Listen for swagger spec in network requests
    const responsePromise = new Promise((resolve) => {
      page.on('response', async (response) => {
        const responseUrl = response.url();
        if (responseUrl.includes('swagger') || responseUrl.includes('openapi')) {
          try {
            const data = await response.json();
            resolve(data);
          } catch (e) {
            const text = await response.text();
            if (text.includes('openapi:') || text.includes('swagger:')) {
              resolve(yaml.parse(text));
            }
          }
        }
      });
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    // Try network response first
    swaggerData = await Promise.race([
      responsePromise,
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);

    // Fallback to window object if needed
    if (!swaggerData) {
      swaggerData = await page.evaluate(() => {
        // @ts-ignore
        return window.ui?.spec?.json;
      });
    }

    if (!swaggerData) {
      throw new Error('Could not find Swagger/OpenAPI specification');
    }

    return swaggerData;
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

export { SwaggerExplorerMCP };
