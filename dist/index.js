"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerExplorerMCP = void 0;
const express_1 = __importDefault(require("express"));
const playwright_1 = require("playwright");
const yaml_1 = __importDefault(require("yaml"));
class SwaggerExplorerMCP {
    constructor(config = {}) {
        this.config = {
            port: 3000,
            ...config
        };
        this.app = (0, express_1.default)();
        this.schemaCache = new Map();
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use(express_1.default.json());
        // Authentication middleware
        const authMiddleware = (req, res, next) => {
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
    setupRoutes() {
        const basePath = this.config.baseUrl || '';
        // Custom response format handler
        const formatResponse = (data, format) => {
            switch (format === null || format === void 0 ? void 0 : format.toLowerCase()) {
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
                    const result = await this.processSwaggerData(swaggerData, options);
                    res.json(formatResponse(result, req.body.format));
                }
                finally {
                    await page.close();
                }
            }
            catch (error) {
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
                }
                finally {
                    await page.close();
                }
            }
            catch (error) {
                console.error('Error getting response schemas:', error);
                res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
            }
        });
    }
    minimizeResponse(data) {
        if (Array.isArray(data)) {
            return data.map(item => this.minimizeResponse(item));
        }
        if (typeof data === 'object' && data !== null) {
            const minimized = {};
            for (const [key, value] of Object.entries(data)) {
                if (value !== null && value !== undefined && value !== '') {
                    minimized[key] = this.minimizeResponse(value);
                }
            }
            return minimized;
        }
        return data;
    }
    async processSwaggerData(swaggerData, options) {
        var _a;
        const result = {};
        if (options.paths) {
            result.paths = Object.entries(swaggerData.paths || {})
                .filter(([_, methods]) => {
                var _a;
                if (!((_a = options.methodFilter) === null || _a === void 0 ? void 0 : _a.length))
                    return true;
                const methodKeys = Object.keys(methods);
                return methodKeys.some(method => { var _a, _b; return (_b = (_a = options.methodFilter) === null || _a === void 0 ? void 0 : _a.includes(method.toLowerCase())) !== null && _b !== void 0 ? _b : false; });
            })
                .map(([path, methods]) => ({
                path,
                methods: Object.keys(methods)
            }));
        }
        if (options.schemas) {
            const schemas = ((_a = swaggerData.components) === null || _a === void 0 ? void 0 : _a.schemas) || swaggerData.definitions || {};
            result.schemas = Object.keys(schemas);
        }
        return result;
    }
    async extractResponseSchemas(swaggerData, path, method) {
        var _a, _b;
        const responses = ((_b = (_a = swaggerData.paths[path]) === null || _a === void 0 ? void 0 : _a[method]) === null || _b === void 0 ? void 0 : _b.responses) || {};
        return Object.entries(responses).map(([code, response]) => ({
            code,
            description: response.description || '',
            formats: Object.entries(response.content || {}).map(([contentType, content]) => ({
                contentType,
                schema: content.schema,
                example: content.example,
                encoding: content.encoding
            }))
        }));
    }
    async start() {
        try {
            this.browser = await playwright_1.chromium.launch();
            this.app.listen(this.config.port, () => {
                console.log(`Swagger Explorer MCP running on port ${this.config.port}`);
                if (this.config.baseUrl) {
                    console.log(`Base URL: ${this.config.baseUrl}`);
                }
                if (this.config.authToken) {
                    console.log('Authentication enabled');
                }
            });
        }
        catch (error) {
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
    async getSwaggerData(url, page) {
        let swaggerData = null;
        // Listen for swagger spec in network requests
        const responsePromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                const responseUrl = response.url();
                if (responseUrl.includes('swagger') || responseUrl.includes('openapi')) {
                    try {
                        const data = await response.json();
                        resolve(data);
                    }
                    catch (e) {
                        const text = await response.text();
                        if (text.includes('openapi:') || text.includes('swagger:')) {
                            resolve(yaml_1.default.parse(text));
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
                var _a, _b;
                // @ts-ignore
                return (_b = (_a = window.ui) === null || _a === void 0 ? void 0 : _a.spec) === null || _b === void 0 ? void 0 : _b.json;
            });
        }
        if (!swaggerData) {
            throw new Error('Could not find Swagger/OpenAPI specification');
        }
        return swaggerData;
    }
}
exports.SwaggerExplorerMCP = SwaggerExplorerMCP;
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
    const config = {
        port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
        baseUrl: process.env.BASE_URL,
        authToken: process.env.AUTH_TOKEN
    };
    const mcp = new SwaggerExplorerMCP(config);
    global.mcp = mcp;
    mcp.start();
}
