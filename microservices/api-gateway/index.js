const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const CircuitBreaker = require('opossum');
const axios = require('axios');
const { promiseTimeout, TimeoutError } = require('promise-timeout');

const app = express();
const PORT = process.env.PORT || 3000;

// Service URLs (configurable via environment variables)
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3001';
const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';
const SHIPPING_SERVICE_URL = process.env.SHIPPING_SERVICE_URL || 'http://localhost:3003';

// Middleware
app.use(bodyParser.json());

// Global rate limiter - 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: 'Too many requests from this IP, please try again after a minute'
});

app.use(globalLimiter);

// Circuit breaker configuration
const circuitBreakerOptions = {
  timeout: 5000, // 5 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
};

// Create circuit breakers for each service
const paymentServiceBreaker = new CircuitBreaker(
  async (path, method, data) => {
    const url = `${PAYMENT_SERVICE_URL}${path}`;
    const response = await axios({ method, url, data });
    return response.data;
  },
  circuitBreakerOptions
);

const inventoryServiceBreaker = new CircuitBreaker(
  async (path, method, data) => {
    const url = `${INVENTORY_SERVICE_URL}${path}`;
    const response = await axios({ method, url, data });
    return response.data;
  },
  circuitBreakerOptions
);

const shippingServiceBreaker = new CircuitBreaker(
  async (path, method, data) => {
    const url = `${SHIPPING_SERVICE_URL}${path}`;
    const response = await axios({ method, url, data });
    return response.data;
  },
  circuitBreakerOptions
);

// Fallback functions
paymentServiceBreaker.fallback(() => ({ error: 'Payment service is currently unavailable' }));
inventoryServiceBreaker.fallback(() => ({ error: 'Inventory service is currently unavailable' }));
shippingServiceBreaker.fallback(() => ({ error: 'Shipping service is currently unavailable' }));

// Time limiter configuration
const TIMEOUT_MS = 3000; // 3 seconds

// Helper function to apply time limiter to service calls
const timeoutServiceCall = async (serviceCall) => {
  try {
    return await promiseTimeout(serviceCall, TIMEOUT_MS);
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw new Error('Service request timed out');
    }
    throw error;
  }
};

// Service proxies with circuit breaker and time limiter
app.use('/api/payments', async (req, res, next) => {
  try {
    const method = req.method.toLowerCase();
    const path = req.url;
    const data = method === 'get' ? undefined : req.body;
    
    const result = await timeoutServiceCall(
      paymentServiceBreaker.fire(`/api/payments${path}`, method, data)
    );
    
    res.json(result);
  } catch (error) {
    console.error('Payment service error:', error.message);
    res.status(503).json({ error: 'Payment service error', message: error.message });
  }
});

app.use('/api/inventory', async (req, res, next) => {
  try {
    const method = req.method.toLowerCase();
    const path = req.url;
    const data = method === 'get' ? undefined : req.body;
    
    const result = await timeoutServiceCall(
      inventoryServiceBreaker.fire(`/api/inventory${path}`, method, data)
    );
    
    res.json(result);
  } catch (error) {
    console.error('Inventory service error:', error.message);
    res.status(503).json({ error: 'Inventory service error', message: error.message });
  }
});

app.use('/api/shipping', async (req, res, next) => {
  try {
    const method = req.method.toLowerCase();
    const path = req.url;
    const data = method === 'get' ? undefined : req.body;
    
    const result = await timeoutServiceCall(
      shippingServiceBreaker.fire(`/api/shipping${path}`, method, data)
    );
    
    res.json(result);
  } catch (error) {
    console.error('Shipping service error:', error.message);
    res.status(503).json({ error: 'Shipping service error', message: error.message });
  }
});

// Order processing endpoint that coordinates between services
app.post('/api/orders', async (req, res) => {
  try {
    const { items, payment, shippingAddress } = req.body;
    
    if (!items || !payment || !shippingAddress) {
      return res.status(400).json({ error: 'Items, payment, and shipping address are required' });
    }
    
    // Step 1: Check inventory
    const inventoryCheck = await timeoutServiceCall(
      inventoryServiceBreaker.fire('/api/inventory/check', 'post', { items })
    );
    
    if (!inventoryCheck.available) {
      return res.status(400).json({ 
        error: 'Some items are not available in the requested quantity',
        details: inventoryCheck.items.filter(item => !item.available)
      });
    }
    
    // Step 2: Process payment
    const orderId = `order-${Date.now()}`;
    const totalAmount = items.reduce((sum, item) => {
      const inventoryItem = inventoryCheck.items.find(i => i.productId === item.productId);
      return sum + (inventoryItem ? item.quantity * inventoryItem.price : 0);
    }, 0);
    
    const paymentResult = await timeoutServiceCall(
      paymentServiceBreaker.fire('/api/payments', 'post', {
        orderId,
        amount: totalAmount,
        currency: payment.currency,
        method: payment.method
      })
    );
    
    if (paymentResult.status !== 'success' && !paymentResult.message?.includes('later')) {
      return res.status(400).json({ error: 'Payment failed', details: paymentResult });
    }
    
    // Step 3: Update inventory
    await timeoutServiceCall(
      inventoryServiceBreaker.fire('/api/inventory/update', 'post', { 
        orderId, 
        items: items.map(item => ({ 
          productId: item.productId, 
          quantity: item.quantity 
        }))
      })
    );
    
    // Step 4: Create shipment
    const shippingResult = await timeoutServiceCall(
      shippingServiceBreaker.fire('/api/shipping', 'post', {
        orderId,
        address: shippingAddress,
        items
      })
    );
    
    // Return complete order information
    res.status(201).json({
      orderId,
      status: 'CREATED',
      timestamp: new Date().toISOString(),
      items: inventoryCheck.items,
      payment: paymentResult,
      shipping: shippingResult
    });
  } catch (error) {
    console.error('Order processing error:', error.message);
    res.status(500).json({ error: 'Failed to process order', message: error.message });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const services = [
      { name: 'payment-service', url: `${PAYMENT_SERVICE_URL}/health` },
      { name: 'inventory-service', url: `${INVENTORY_SERVICE_URL}/health` },
      { name: 'shipping-service', url: `${SHIPPING_SERVICE_URL}/health` }
    ];
    
    const results = await Promise.allSettled(
      services.map(service => 
        axios.get(service.url, { timeout: 2000 })
          .then(() => ({ service: service.name, status: 'UP' }))
          .catch(() => ({ service: service.name, status: 'DOWN' }))
      )
    );
    
    const serviceStatuses = results.map(result => 
      result.status === 'fulfilled' ? result.value : { service: result.reason.service, status: 'DOWN' }
    );
    
    const allUp = serviceStatuses.every(s => s.status === 'UP');
    
    res.json({
      status: allUp ? 'UP' : 'PARTIAL',
      gateway: 'UP',
      services: serviceStatuses
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
