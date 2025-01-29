# Swagger Explorer MCP

A Management Control Plane (MCP) server for exploring and analyzing Swagger/OpenAPI specifications through Claude.

## Quick Start

Install and run globally using npx:
```bash
npx -y @johnneerdael/swagger-mcp
```

Or install with environment variables:
```bash
npx -y @johnneerdael/swagger-mcp \
  --env BASE_URL=/api \
  --env AUTH_TOKEN=your-token \
  --env PORT=3000
```

## Installation for Claude Desktop

1. Open Claude Desktop
2. Click on Settings (gear icon)
3. Select "Tools & Integrations"
4. Click "Add MCP Server"
5. Enter the following:
   ```
   Name: Swagger Explorer
   Command: npx -y @johnneerdael/swagger-mcp
   Arguments: --swagger-url=$SWAGGER_URL
   ```
6. Click "Install"

## Usage with Claude

Here are some example interactions with Claude:

### Basic Swagger Exploration

```
Human: Can you explore the Swagger documentation at http://localhost:8080/docs?

Claude: I'll help you explore that Swagger documentation using the Swagger Explorer MCP.

Let me analyze the API endpoints and schemas for you:

[Claude would then use the MCP to fetch and analyze the Swagger documentation]
```

### Analyzing Specific Endpoints

```
Human: What are the available response schemas for the /pets POST endpoint?

Claude: I'll check the response schemas for that endpoint using the MCP.

[Claude would use the MCP to fetch specific endpoint details]
```

### Schema Analysis

```
Human: Can you show me the detailed structure of the Pet schema?

Claude: I'll retrieve the detailed schema information using the MCP.

[Claude would use the MCP to analyze the schema structure]
```

## Features

1. **Authentication Support**
   - Bearer token authentication
   - Configurable through environment variables

2. **Custom Response Formatting**
   - Minimal format: Removes null/empty values
   - Detailed format: Includes metadata and timestamps
   - Raw format: Unmodified response

3. **Schema Analysis**
   - Detailed property exploration
   - Response schema analysis
   - Schema relationships

4. **API Exploration**
   - Path listing
   - Method filtering
   - Response format analysis

## Configuration

Environment Variables:
- `BASE_URL`: Base path for the API (default: '')
- `AUTH_TOKEN`: Bearer token for authentication
- `PORT`: Server port (default: 3000)
- `SWAGGER_URL`: Default Swagger documentation URL

## API Endpoints

### Explore API
```bash
curl -X POST http://localhost:3000/api/explore \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://your-swagger-url",
    "options": {
      "paths": true,
      "schemas": true
    }
  }'
```

### Get Schema Details
```bash
curl -X POST http://localhost:3000/api/schema-details \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://your-swagger-url",
    "schemaName": "Pet"
  }'
```

### Get Response Schemas
```bash
curl -X POST http://localhost:3000/api/response-schemas \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://your-swagger-url",
    "path": "/pets",
    "method": "post"
  }'
```

## Response Formats

### Minimal Format
```json
{
  "status": "success",
  "data": {
    // Only non-null values
  }
}
```

### Detailed Format
```json
{
  "status": "success",
  "timestamp": "2025-01-29T10:00:00.000Z",
  "data": {
    // Full response
  },
  "metadata": {
    "version": "1.0",
    "format": "detailed"
  }
}
```

## Common Use Cases

1. **API Documentation Review**
   ```
   Human: Can you summarize all the available endpoints and their purposes?
   ```

2. **Schema Validation**
   ```
   Human: What fields are required for creating a new pet?
   ```

3. **Response Analysis**
   ```
   Human: What are the possible error responses for the login endpoint?
   ```

4. **Integration Planning**
   ```
   Human: How should I structure my request to create a new order?
   ```

## Troubleshooting

1. **Connection Issues**
   - Ensure the Swagger URL is accessible
   - Check if authentication token is correct
   - Verify port is not in use

2. **Authorization Errors**
   - Verify AUTH_TOKEN is set correctly
   - Ensure bearer token is included in requests

3. **Schema Not Found**
   - Check if schema name is exact match
   - Verify Swagger spec is loaded correctly

## Security Notes

1. The MCP requires authentication if AUTH_TOKEN is set
2. All requests are logged for debugging
3. Sensitive information is not cached
4. Rate limiting is applied to prevent abuse

## Development

To contribute or modify:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build:
   ```bash
   npm run build
   ```
4. Run locally:
   ```bash
   npm start
   ```

## License

MIT License - See LICENSE file for details
