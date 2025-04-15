const express = require('express');
const axios = require('axios');
const { TimeoutError } = require('promise-timeout');
const promiseTimeout = require('promise-timeout');

const app = express();
const PORT = 3000;
const SERVICE_B_URL = 'http://localhost:3001/api';

app.use(express.json());

app.get('/api', async (req, res) => {
  try {
    // Giới hạn thời gian chờ là 2 giây
    const result = await promiseTimeout.timeout(axios.get(SERVICE_B_URL), 2000);
    res.json(result.data);
  } catch (error) {
    if (error instanceof TimeoutError) {
      res.status(504).json({ error: "Request to Service B timed out" });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
});