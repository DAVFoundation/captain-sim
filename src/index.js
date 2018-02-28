const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');

const app = express();
const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || "0.0.0.0";
const davApiUrl = process.env.DAV_API_URL || "https://api.dav.network:8888";

app.use(bodyParser.json());

app.get('/healthy', (req, res) => {
  request(`${davApiUrl}/healthy`)
    .then(data => {
      res.send(data);
    })
    .catch(err => {
      res.status(500).send(err);
    });
});

app.listen(port, hostname, () => {
  console.log(`Web server started. Listening on ${hostname}:${port}`);
});
