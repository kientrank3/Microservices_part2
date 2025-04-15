const express = require('express');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const CircuitBreaker = require('opossum');
const retry = require('async-retry');

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(bodyParser.json());

// Rate limiter - 10 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many requests from this IP, please try again after a minute'
});

// Apply rate limiting to all shipping endpoints
app.use('/api/shipping', apiLimiter);

// In-memory database for shipments
const shipments = [];

// Circuit breaker configuration for external shipping provider
const circuitBreakerOptions = {
  timeout: 3000,
  errorThresholdPercentage: 50,
  resetTimeout: 10000
};

// Simulate external shipping provider
const externalShippingProvider = async (shipmentData) => {
  // Simulate random failures (25% chance)
  if (Math.random() < 0.25) {
    throw new Error('Shipping provider unavailable');
  }
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return {
    trackingNumber: `TRK${Date.now()}`,
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
    carrier: 'Express Shipping'
  };
};

// Create circuit breaker for shipping provider
const shippingProviderBreaker = new CircuitBreaker(externalShippingProvider, circuitBreakerOptions);

// Fallback function when circuit is open
shippingProviderBreaker.fallback(() => ({
  trackingNumber: `PENDING-${Date.now()}`,
  estimatedDelivery: 'Pending',
  carrier: 'Pending',
  message: 'Shipping service is experiencing issues, shipment will be processed later'
}));

// Retry configuration
const retryOptions = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 3000,
  onRetry: (error, attempt) => {
    console.log(`Retry attempt ${attempt} for shipping operation due to: ${error.message}`);
  }
};

// Routes
app.post('/api/shipping', async (req, res) => {
  try {
    const { orderId, address, items } = req.body;
    
    if (!orderId || !address || !items) {
      return res.status(400).json({ error: 'Order ID, address, and items are required' });
    }
    
    const shipmentData = {
      orderId,
      address,
      items,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    
    // Process shipment through circuit breaker and retry pattern
    const shippingResult = await retry(async () => {
      return await shippingProviderBreaker.fire(shipmentData);
    }, retryOptions);
    
    // Create shipment record
    const shipment = {
      ...shipmentData,
      trackingNumber: shippingResult.trackingNumber,
      estimatedDelivery: shippingResult.estimatedDelivery,
      carrier: shippingResult.carrier,
      status: 'PROCESSING'
    };
    
    shipments.push(shipment);
    
    res.status(201).json(shipment);
  } catch (error) {
    console.error('Shipping error:', error.message);
    res.status(500).json({ error: 'Failed to create shipment', message: error.message });
  }
});

app.get('/api/shipping/:orderId', (req, res) => {
  const { orderId } = req.params;
  const shipment = shipments.find(s => s.orderId === orderId);
  
  if (!shipment) {
    return res.status(404).json({ error: 'Shipment not found' });
  }
  
  res.json(shipment);
});

app.put('/api/shipping/:orderId/status', (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const shipment = shipments.find(s => s.orderId === orderId);
    
    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }
    
    // Validate status
    const validStatuses = ['PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status', validStatuses });
    }
    
    // Update status
    shipment.status = status;
    shipment.updatedAt = new Date().toISOString();
    
    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update shipment status', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'shipping-service' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Shipping Service running on port ${PORT}`);
});
