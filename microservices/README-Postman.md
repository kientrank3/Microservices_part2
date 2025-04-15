# Testing Microservices with Postman

This guide explains how to use the provided Postman collection to test the microservices.

## Prerequisites

1. [Postman](https://www.postman.com/downloads/) installed on your computer
2. Microservices running (either via Docker Compose or individually)

## Importing the Collection

1. Open Postman
2. Click on "Import" button in the top left
3. Select the file `Microservices_Fault_Tolerance.postman_collection.json`
4. The collection will be imported with all the requests

## Collection Structure

The collection is organized into folders:

1. **API Gateway** - Tests for the API Gateway endpoints
2. **Payment Service** - Tests for the Payment Service endpoints
3. **Inventory Service** - Tests for the Inventory Service endpoints
4. **Shipping Service** - Tests for the Shipping Service endpoints
5. **Direct Service Access** - Tests that bypass the API Gateway and access services directly
6. **Fault Tolerance Tests** - Specific tests designed to trigger fault tolerance patterns

## Testing Fault Tolerance Patterns

### Circuit Breaker Pattern

1. Navigate to the "Fault Tolerance Tests" folder
2. Run the "Circuit Breaker Test" request multiple times in quick succession
3. After several requests, you should see the circuit breaker activate and return a fallback response

### Retry Pattern

1. Navigate to the "Fault Tolerance Tests" folder
2. Run the "Retry Test" request
3. Check the console logs of the Inventory Service to see retry attempts

### Time Limiter Pattern

1. Navigate to the "Fault Tolerance Tests" folder
2. Run the "Time Limiter Test" request
3. Depending on the random delay in the Inventory Service, you might get a successful response or a timeout

### Rate Limiter Pattern

1. Navigate to the "Fault Tolerance Tests" folder
2. Use the Collection Runner to run "Rate Limiter Test (Run Collection)"
   - Click on the collection name
   - Click "Run" button
   - Set iterations to 15
   - Click "Run Microservices Fault Tolerance"
3. After several requests, you should see rate limiting kick in with 429 status codes

## Testing Complete Order Flow

1. Navigate to the "API Gateway" folder
2. Run the "Create Order" request
3. This will test the coordination between all services:
   - Check inventory availability
   - Process payment
   - Update inventory
   - Create shipment

## Viewing Test Results

After running requests, you can:

1. Check the response status and body in Postman
2. View the console logs of each service to see what's happening behind the scenes
3. For tests with scripts, check the "Test Results" tab in Postman to see if tests passed

## Troubleshooting

If you encounter issues:

1. Make sure all services are running
2. Check the "Health Check" endpoint in the API Gateway folder
3. Try the direct health check endpoints in the "Direct Service Access" folder
4. Check the console logs of each service for error messages
