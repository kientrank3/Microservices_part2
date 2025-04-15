const axios = require('axios');

const API_GATEWAY_URL = 'http://localhost:3000';

// Helper function to make API calls
async function callAPI(endpoint, method = 'get', data = null) {
  try {
    const config = {
      method,
      url: `${API_GATEWAY_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error(`Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return error.response.data;
    } else {
      console.error(`Error: ${error.message}`);
      return { error: error.message };
    }
  }
}

// Test functions
async function testCircuitBreaker() {
  console.log('\n=== Testing Circuit Breaker Pattern ===');
  
  // Make multiple requests to trigger circuit breaker
  for (let i = 0; i < 10; i++) {
    console.log(`\nRequest ${i + 1}:`);
    const result = await callAPI('/api/payments', 'post', {
      orderId: `test-order-${Date.now()}`,
      amount: 100,
      currency: 'USD',
      method: 'credit_card'
    });
    
    console.log(JSON.stringify(result, null, 2));
    
    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function testRetry() {
  console.log('\n=== Testing Retry Pattern ===');
  
  // Test inventory service which uses retry pattern
  const result = await callAPI('/api/inventory/prod-001');
  console.log(JSON.stringify(result, null, 2));
}

async function testRateLimiter() {
  console.log('\n=== Testing Rate Limiter Pattern ===');
  
  // Make multiple requests quickly to trigger rate limiter
  const promises = [];
  for (let i = 0; i < 15; i++) {
    promises.push(callAPI('/api/shipping', 'post', {
      orderId: `test-order-${Date.now()}-${i}`,
      address: {
        street: '123 Test St',
        city: 'Test City',
        zipCode: '12345',
        country: 'Test Country'
      },
      items: [{ productId: 'prod-001', quantity: 1 }]
    }));
  }
  
  const results = await Promise.all(promises);
  results.forEach((result, index) => {
    console.log(`\nRequest ${index + 1}:`);
    console.log(JSON.stringify(result, null, 2));
  });
}

async function testTimeLimiter() {
  console.log('\n=== Testing Time Limiter Pattern ===');
  
  // Test inventory service which has time limiter
  const result = await callAPI('/api/inventory');
  console.log(JSON.stringify(result, null, 2));
}

async function testCompleteOrder() {
  console.log('\n=== Testing Complete Order Flow ===');
  
  const orderData = {
    items: [
      { productId: 'prod-001', quantity: 1 },
      { productId: 'prod-002', quantity: 2 }
    ],
    payment: {
      currency: 'USD',
      method: 'credit_card'
    },
    shippingAddress: {
      street: '123 Test St',
      city: 'Test City',
      zipCode: '12345',
      country: 'Test Country'
    }
  };
  
  const result = await callAPI('/api/orders', 'post', orderData);
  console.log(JSON.stringify(result, null, 2));
}

// Run all tests
async function runTests() {
  try {
    // First check if services are up
    console.log('Checking service health...');
    const health = await callAPI('/health');
    console.log(JSON.stringify(health, null, 2));
    
    if (health.status === 'DOWN') {
      console.error('Services are not running. Please start the services first.');
      return;
    }
    
    // Run individual tests
    await testCircuitBreaker();
    await testRetry();
    await testRateLimiter();
    await testTimeLimiter();
    await testCompleteOrder();
    
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// Run the tests
runTests();
