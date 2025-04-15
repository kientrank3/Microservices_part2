const express = require('express');
const bodyParser = require('body-parser');
const CircuitBreaker = require('opossum');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(bodyParser.json());

// In-memory database for payments
const payments = [];

// Circuit breaker configuration for external service calls
const circuitBreakerOptions = {
  timeout: 3000, // Timeout after 3 seconds
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 10000 // Reset circuit after 10 seconds
};

// Simulate external payment gateway
const processPaymentGateway = async (paymentData) => {
  // Simulate random failures (20% chance)
  if (Math.random() < 0.2) {
    throw new Error('Payment gateway error');
  }
  
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    transactionId: `txn_${Date.now()}`,
    status: 'success',
    amount: paymentData.amount
  };
};

// Create circuit breaker for payment gateway
const paymentGatewayBreaker = new CircuitBreaker(processPaymentGateway, circuitBreakerOptions);

// Fallback function when circuit is open
paymentGatewayBreaker.fallback(() => ({
  transactionId: `fallback_${Date.now()}`,
  status: 'pending',
  message: 'Payment service is experiencing issues, payment will be processed later'
}));

// Routes
app.post('/api/payments', async (req, res) => {
  try {
    const { orderId, amount, currency = 'USD', method = 'credit_card' } = req.body;
    
    if (!orderId || !amount) {
      return res.status(400).json({ error: 'Order ID and amount are required' });
    }
    
    const paymentData = {
      orderId,
      amount,
      currency,
      method,
      timestamp: new Date().toISOString()
    };
    
    // Process payment through circuit breaker
    const result = await paymentGatewayBreaker.fire(paymentData);
    
    // Store payment information
    const payment = {
      ...paymentData,
      transactionId: result.transactionId,
      status: result.status
    };
    
    payments.push(payment);
    
    res.status(201).json(payment);
  } catch (error) {
    console.error('Payment processing error:', error.message);
    res.status(500).json({ error: 'Failed to process payment', message: error.message });
  }
});

// Get payment by order ID
app.get('/api/payments/:orderId', (req, res) => {
  const { orderId } = req.params;
  const payment = payments.find(p => p.orderId === orderId);
  
  if (!payment) {
    return res.status(404).json({ error: 'Payment not found' });
  }
  
  res.json(payment);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'payment-service' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});
