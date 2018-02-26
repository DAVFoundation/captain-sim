const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || "0.0.0.0";
const davApiUrl = process.env.DAV_API_URL || "https://api.dav.network:8888";

app.use(bodyParser.json());

app.get('/healthy', (req, res) => {
  res.send('hello world');
});

app.listen(port, hostname, () => {
  console.log(`Web server started. Listening on ${hostname}:${port}`);
});
