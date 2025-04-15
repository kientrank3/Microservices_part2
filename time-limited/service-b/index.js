const express = require('express');
const app = express();
const PORT = 3001;

app.use(express.json());

app.get('/api', async (req, res) => {
  // Giả lập delay từ 1-3 giây
  const delay = Math.floor(Math.random() * 2000) + 1000;
  
  await new Promise(resolve => {console.log(`Service B is processing for ${delay}ms`);setTimeout(resolve, delay)});
  
  res.json({ 
    message: `Hello from Service B after ${delay}ms delay`,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
});