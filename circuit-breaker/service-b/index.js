const express = require('express');
const app = express();
const PORT = 3001;

let shouldFail = 0;

app.use(express.json());

app.get('/api', (req, res) => {
  if (shouldFail == 5) {
    shouldFail=0; // Đổi trạng thái cho lần request tiếp theo
    res.status(500).json({ message: "Service B failed intentionally" });
  } else {
    shouldFail ++;
    res.json({ message: "Hello from Service B" });
  }
});

app.listen(PORT, () => {
  console.log(`Service B running on port ${PORT}`);
});