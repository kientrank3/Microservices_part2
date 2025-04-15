# Microservices with Fault Tolerance Patterns

This project demonstrates a microservices architecture with various fault tolerance patterns implemented.

## Services

- **API Gateway**: Acts as a single entry point for clients to interact with the microservices
- **Payment Service**: Handles payment processing
- **Inventory Service**: Manages product inventory
- **Shipping Service**: Handles shipping and order tracking

## Fault Tolerance Patterns

The following fault tolerance patterns are implemented:

1. **Circuit Breaker**: Prevents cascading failures by failing fast when a service is unavailable
2. **Retry**: Automatically retries failed operations with exponential backoff
3. **Rate Limiter**: Limits the number of requests to protect services from overload
4. **Time Limiter**: Sets timeouts for service calls to prevent long-running operations

## Running the Services

### Using Docker Compose

The easiest way to run all services is using Docker Compose:

```bash
cd microservices
docker-compose up --build
```

This will build and start all services:
- API Gateway: http://localhost:3000
- Payment Service: http://localhost:3001
- Inventory Service: http://localhost:3002
- Shipping Service: http://localhost:3003

### Running Individually

If you prefer to run services individually:

1. Install dependencies for each service:
```bash
cd microservices/api-gateway
npm install
cd ../payment-service
npm install
cd ../inventory-service
npm install
cd ../shipping-service
npm install
```

2. Start each service in a separate terminal:
```bash
# Terminal 1
cd microservices/payment-service
node index.js

# Terminal 2
cd microservices/inventory-service
node index.js

# Terminal 3
cd microservices/shipping-service
node index.js

# Terminal 4
cd microservices/api-gateway
node index.js
```

## Testing Fault Tolerance

A test script is provided to demonstrate the fault tolerance patterns:

```bash
cd microservices
npm install axios
node test-fault-tolerance.js
```

This script will:
1. Test the Circuit Breaker pattern by making multiple requests to the Payment Service
2. Test the Retry pattern with the Inventory Service
3. Test the Rate Limiter pattern with the Shipping Service
4. Test the Time Limiter pattern with the Inventory Service
5. Test a complete order flow that uses all services

## API Endpoints

### API Gateway

- `GET /health`: Check the health of all services
- `POST /api/orders`: Create a new order (coordinates between all services)

### Payment Service

- `POST /api/payments`: Process a payment
- `GET /api/payments/:orderId`: Get payment details for an order

### Inventory Service

- `GET /api/inventory`: Get all inventory items
- `GET /api/inventory/:productId`: Get a specific inventory item
- `POST /api/inventory/check`: Check if items are available in inventory
- `POST /api/inventory/update`: Update inventory for an order

### Shipping Service

- `POST /api/shipping`: Create a new shipment
- `GET /api/shipping/:orderId`: Get shipment details for an order
- `PUT /api/shipping/:orderId/status`: Update shipment status
