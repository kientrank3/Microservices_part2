const express = require('express');
const axios = require('axios');
const retry = require('async-retry');

const app = express();
const PORT = 3000;
const SERVICE_B_URL = 'http://localhost:3001/api';

app.use(express.json());

app.get('/api', async (req, res) => {
  try {
    const result = await retry(
      async (bail) => {
        try {
          const response = await axios.get(SERVICE_B_URL);
          return response.data;
        } catch (error) {
          if (error.response && error.response.status === 404) {
            bail(new Error('Not Found'));
            return;
          }
          throw error;
        }
      },
      {
        retries: 5,
        minTimeout: 1000,
        maxTimeout: 2000,
      }
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Service A running on port ${PORT}`);
});