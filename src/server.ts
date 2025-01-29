import { createMCPServer, MCPRequest, MCPResponse } from '@modelcontextprotocol/sdk';
import { SwaggerExplorerMCP } from './index';
import {
  ExploreInputSchema,
  ExploreOutputSchema,
  ResponseSchemaInputSchema,
  ResponseSchemaOutputSchema,
} from './schemas';

export async function createServer(config: any) {
  const swaggerExplorer = new SwaggerExplorerMCP(config);
  const port = await swaggerExplorer.start();

  const server = createMCPServer({
    methods: {
      explore: {
        description: 'Explore a Swagger/OpenAPI specification',
        input: ExploreInputSchema,
        output: ExploreOutputSchema,
        handler: async (request: MCPRequest) => {
          try {
            const result = await fetch(`http://localhost:${port}/api/explore`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {}),
              },
              body: JSON.stringify(request.input),
            });

            if (!result.ok) {
              throw new Error(`Failed to explore Swagger: ${result.statusText}`);
            }

            const data = await result.json();
            return new MCPResponse(data);
          } catch (error) {
            throw new Error(`Explore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      },
      getResponseSchemas: {
        description: 'Get response schemas for a specific path and method',
        input: ResponseSchemaInputSchema,
        output: ResponseSchemaOutputSchema,
        handler: async (request: MCPRequest) => {
          try {
            const result = await fetch(`http://localhost:${port}/api/response-schemas`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(config.authToken ? { 'Authorization': `Bearer ${config.authToken}` } : {}),
              },
              body: JSON.stringify(request.input),
            });

            if (!result.ok) {
              throw new Error(`Failed to get response schemas: ${result.statusText}`);
            }

            const data = await result.json();
            return new MCPResponse(data);
          } catch (error) {
            throw new Error(`Get response schemas failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        },
      },
    },
  });

  return {
    server,
    swaggerExplorer,
  };
}
