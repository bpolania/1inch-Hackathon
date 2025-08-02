import swaggerJsdoc from 'swagger-jsdoc';
import { readFileSync } from 'fs';
import { join } from 'path';

const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
const version = packageJson.version;

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: '1inch Fusion+ Cross-Chain API Gateway',
    version,
    description: 'API Gateway for 1inch Fusion+ cross-chain swaps with TEE solver integration',
    contact: {
      name: 'API Support',
      url: 'https://github.com/bpolania/1inch-Hackathon'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3002',
      description: 'Development server'
    },
    {
      url: 'https://api.1inch-fusion.io',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: '1inch',
      description: '1inch Fusion+ cross-chain swap endpoints'
    },
    {
      name: 'Orders',
      description: 'Order management endpoints'
    },
    {
      name: 'Transactions',
      description: 'Transaction status and lifecycle tracking'
    },
    {
      name: 'System',
      description: 'System health and metrics endpoints'
    },
    {
      name: 'Chains',
      description: 'Supported chains and routes'
    },
    {
      name: 'Users',
      description: 'User management endpoints'
    }
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            example: 'Error message'
          },
          details: {
            type: 'string',
            example: 'Detailed error information'
          }
        }
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true
          },
          data: {
            type: 'object'
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          }
        }
      }
    }
  }
};

const options = {
  swaggerDefinition,
  apis: [
    './src/routes/*.ts',
    './src/swagger/schemas/*.yaml'
  ]
};

export const swaggerSpec = swaggerJsdoc(options);