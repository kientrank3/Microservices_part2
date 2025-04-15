const express = require('express');
const app = express();
const PORT = 3001;

let attempt = 0;

app.use(express.json());

app.get('/api', (req, res) => {
  attempt++;
  console.log(`Attempt ${attempt} to Service B`);
  if (attempt % 5 !== 0) { // Chỉ thành công sau 5 lần thử
    res.status(500).json({ message: "Service B failed, please retry" });
  } else {
    attempt = 0;
    res.json({ message: "Hello from Service B after retries" });
  }
});

app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
});