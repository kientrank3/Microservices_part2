const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ 
    message: "Hello from Service B",
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
});