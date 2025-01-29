import { z } from 'zod';

// Basic input schemas
export const SwaggerUrlSchema = z.object({
  url: z.string().url(),
  format: z.enum(['minimal', 'detailed']).optional(),
});

export const SwaggerOptionsSchema = z.object({
  paths: z.boolean().optional(),
  schemas: z.boolean().optional(),
  methodFilter: z.array(z.string()).optional(),
});

export const PathMethodSchema = z.object({
  url: z.string().url(),
  path: z.string(),
  method: z.string(),
  format: z.enum(['minimal', 'detailed']).optional(),
});

// Response schemas
export const SchemaPropertySchema = z.object({
  type: z.string().optional(),
  format: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
  enum: z.array(z.unknown()).optional(),
  items: z.object({
    type: z.string().optional(),
    $ref: z.string().optional(),
  }).optional(),
  $ref: z.string().optional(),
});

export const SchemaDetailsSchema = z.object({
  type: z.string(),
  properties: z.record(SchemaPropertySchema),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
  example: z.unknown().optional(),
  responses: z.array(z.object({
    code: z.string(),
    description: z.string(),
    formats: z.array(z.object({
      contentType: z.string(),
      schema: z.unknown(),
      example: z.unknown().optional(),
      encoding: z.unknown().optional(),
    })),
  })).optional(),
});

// MCP method schemas
export const ExploreInputSchema = SwaggerUrlSchema.merge(z.object({
  options: SwaggerOptionsSchema.optional(),
}));

export const ExploreOutputSchema = z.object({
  paths: z.array(z.object({
    path: z.string(),
    methods: z.array(z.string()),
  })).optional(),
  schemas: z.array(z.string()).optional(),
});

export const ResponseSchemaInputSchema = PathMethodSchema;

export const ResponseSchemaOutputSchema = z.array(z.object({
  code: z.string(),
  description: z.string(),
  formats: z.array(z.object({
    contentType: z.string(),
    schema: z.unknown(),
    example: z.unknown().optional(),
    encoding: z.unknown().optional(),
  })),
}));
