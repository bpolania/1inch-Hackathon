# API Gateway Swagger Documentation

## Overview

The API Gateway includes comprehensive Swagger/OpenAPI documentation for all endpoints. This documentation is automatically generated from JSDoc comments in the route files and provides an interactive UI for testing the API.

## Accessing Swagger Documentation

Once the API Gateway is running, you can access the Swagger UI at:

```
http://localhost:3002/api-docs
```

## Features

### Interactive API Explorer
- Test endpoints directly from the browser
- View request/response schemas
- See example payloads
- Try out different parameters

### Organized by Tags
- **1inch**: Cross-chain swap endpoints
- **Orders**: Order management endpoints  
- **Transactions**: Transaction tracking and lifecycle
- **System**: Health checks and metrics
- **Chains**: Supported chains and routes
- **Users**: User management and wallets

### Complete Schema Documentation
- Request body schemas with validation rules
- Response schemas with examples
- Error response formats
- Query parameter descriptions

## API Endpoints

### 1inch Fusion+ Integration
- `GET /api/1inch/quote` - Get cross-chain quotes
- `POST /api/1inch/swap` - Create cross-chain swaps
- `GET /api/1inch/tokens/{chainId}` - Get supported tokens
- `GET /api/1inch/protocols/{chainId}` - Get protocols/adapters

### Order Management
- `GET /api/1inch/orders` - List user orders
- `GET /api/1inch/orders/{orderHash}` - Get order details
- `GET /api/1inch/orders/{orderHash}/status` - Detailed status
- `DELETE /api/1inch/orders/{orderHash}` - Cancel order

### Transaction Status
- `GET /api/transactions/status/{txHash}` - Single transaction
- `GET /api/transactions/multi-status/{txId}` - Cross-chain bundle
- `GET /api/transactions/lifecycle/{intentId}` - Full lifecycle

### System & Health
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed service status

## Development

### Adding New Documentation

1. Add JSDoc comments above your route:
```typescript
/**
 * @swagger
 * /api/your-endpoint:
 *   get:
 *     summary: Brief description
 *     description: Detailed description
 *     tags: [YourTag]
 *     parameters:
 *       - in: path
 *         name: param
 *         schema:
 *           type: string
 *         description: Parameter description
 *     responses:
 *       200:
 *         description: Success response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/YourSchema'
 */
```

2. Add schemas in `src/swagger/schemas/` as YAML files

3. The documentation will be automatically generated

### Swagger Configuration

Configuration is in `src/swagger/config.ts`:
- OpenAPI version: 3.0.0
- Auto-generated from route files
- Custom styling and branding

## Testing with Swagger

1. Navigate to the endpoint you want to test
2. Click "Try it out"
3. Fill in the parameters
4. Click "Execute"
5. View the response below

The Swagger UI provides curl commands and request URLs that you can use in your own applications.

## Security

The Swagger documentation respects the same security settings as the API:
- CORS configuration
- Rate limiting
- Authentication headers (when implemented)

## Troubleshooting

If Swagger UI is not loading:
1. Ensure the API Gateway is running
2. Check the console for errors
3. Verify port 3002 is available
4. Check that all dependencies are installed