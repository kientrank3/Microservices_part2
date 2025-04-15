const express = require('express');
const bodyParser = require('body-parser');
const retry = require('async-retry');
const { promiseTimeout, TimeoutError } = require('promise-timeout');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(bodyParser.json());

// In-memory database for inventory
const inventory = [
  { id: 'prod-001', name: 'Laptop', quantity: 10, price: 1200 },
  { id: 'prod-002', name: 'Smartphone', quantity: 15, price: 800 },
  { id: 'prod-003', name: 'Headphones', quantity: 20, price: 100 }
];

// Retry configuration
const retryOptions = {
  retries: 3,
  minTimeout: 1000,
  maxTimeout: 3000,
  onRetry: (error, attempt) => {
    console.log(`Retry attempt ${attempt} for inventory operation due to: ${error.message}`);
  }
};

// Time limiter configuration
const TIMEOUT_MS = 2000;

// Routes
app.get('/api/inventory', async (req, res) => {
  try {
    // Apply time limiter to the inventory fetch operation
    const result = await promiseTimeout(
      new Promise((resolve) => {
        // Simulate random delay
        const delay = Math.floor(Math.random() * 3000);
        setTimeout(() => {
          resolve(inventory);
        }, delay);
      }),
      TIMEOUT_MS
    );
    
    res.json(result);
  } catch (error) {
    if (error instanceof TimeoutError) {
      res.status(504).json({ error: 'Inventory service timed out' });
    } else {
      res.status(500).json({ error: 'Failed to fetch inventory', message: error.message });
    }
  }
});

app.get('/api/inventory/:productId', async (req, res) => {
  const { productId } = req.params;
  
  try {
    // Use retry pattern for fetching a specific product
    const product = await retry(async () => {
      // Simulate random failures (30% chance)
      if (Math.random() < 0.3) {
        throw new Error('Database connection error');
      }
      
      const item = inventory.find(item => item.id === productId);
      if (!item) {
        const error = new Error('Product not found');
        error.status = 404;
        throw error;
      }
      
      return item;
    }, retryOptions);
    
    res.json(product);
  } catch (error) {
    const statusCode = error.status || 500;
    res.status(statusCode).json({ 
      error: statusCode === 404 ? 'Product not found' : 'Failed to fetch product', 
      message: error.message 
    });
  }
});

app.post('/api/inventory/check', async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array is required' });
    }
    
    const results = [];
    let allAvailable = true;
    
    for (const item of items) {
      const { productId, quantity } = item;
      
      if (!productId || !quantity) {
        return res.status(400).json({ error: 'Product ID and quantity are required for each item' });
      }
      
      const inventoryItem = inventory.find(i => i.id === productId);
      
      if (!inventoryItem) {
        results.push({ productId, available: false, message: 'Product not found' });
        allAvailable = false;
        continue;
      }
      
      const isAvailable = inventoryItem.quantity >= quantity;
      
      results.push({
        productId,
        name: inventoryItem.name,
        requested: quantity,
        available: isAvailable,
        inStock: inventoryItem.quantity
      });
      
      if (!isAvailable) {
        allAvailable = false;
      }
    }
    
    res.json({
      available: allAvailable,
      items: results
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check inventory', message: error.message });
  }
});

app.post('/api/inventory/update', async (req, res) => {
  try {
    const { items, orderId } = req.body;
    
    if (!items || !Array.isArray(items) || !orderId) {
      return res.status(400).json({ error: 'Items array and order ID are required' });
    }
    
    // Use retry pattern for inventory update
    const result = await retry(async () => {
      // Simulate random failures (20% chance)
      if (Math.random() < 0.2) {
        throw new Error('Database update error');
      }
      
      const updatedItems = [];
      
      for (const item of items) {
        const { productId, quantity } = item;
        
        if (!productId || !quantity) {
          throw new Error('Product ID and quantity are required for each item');
        }
        
        const inventoryItem = inventory.find(i => i.id === productId);
        
        if (!inventoryItem) {
          throw new Error(`Product ${productId} not found`);
        }
        
        if (inventoryItem.quantity < quantity) {
          throw new Error(`Insufficient quantity for product ${productId}`);
        }
        
        // Update inventory
        inventoryItem.quantity -= quantity;
        
        updatedItems.push({
          productId,
          name: inventoryItem.name,
          quantityReduced: quantity,
          newQuantity: inventoryItem.quantity
        });
      }
      
      return {
        orderId,
        timestamp: new Date().toISOString(),
        updatedItems
      };
    }, retryOptions);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update inventory', message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'inventory-service' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
