const express = require('express');
const axios = require('axios');
const CircuitBreaker = require('opossum');

const app = express();
const PORT = 3000;
const SERVICE_B_URL = 'http://localhost:3001/api';

app.use(express.json());

// Tạo circuit breaker cho calls đến service B
const breaker = new CircuitBreaker(async () => {
  const response = await axios.get(SERVICE_B_URL);
  return response.data;
}, {
  timeout: 3000, // Timeout sau 3 giây
  errorThresholdPercentage: 50, // Mở CB khi 50% requests fail
  resetTimeout: 10000 // Đóng lại sau 10 giây
});

breaker.fallback(() => ({ message: "Service B unavailable (Circuit Breaker activated)" }));

app.get('/api', async (req, res) => {
  try {
    const result = await breaker.fire();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
});