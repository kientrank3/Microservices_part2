const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3000;
const SERVICE_B_URL = 'http://localhost:3001/api';

// Giới hạn 5 requests mỗi phút từ một IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5,
  message: 'Too many requests from this IP, please try again after a minute'
});

app.use(express.json());
app.use(limiter);

app.get('/api', async (req, res) => {
  try {
    const response = await axios.get(SERVICE_B_URL);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
});