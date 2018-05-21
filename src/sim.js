if (process.env.NODE_ENV === 'development') require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mnemonic = require('../mnemonic');
const cors = require('./cors');
const {
  generateRandomVehicles,
  getVehicles,
  randomBid,
  addVehicles
} = require('./simulation/vehicles');
const { generateRandom } = require('./simulation/drone');

const app = express();
const {
  DavSDK
} = require('dav-js');
const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || '0.0.0.0';

const dav = new DavSDK('123456789', '123456789', mnemonic);
dav.initCaptain(generateRandom({coords: { lat: 0, long: 0 }, radius:1000}));

const droneDelivery = dav.needs().forType('drone_delivery', {
  global: true,
  ttl: 1200
});

droneDelivery.subscribe(
  onNeed,
  err => console.log(err),
  () => console.log('completed')
);

const generateBidFromVehicle = async (vehicle, pickup, dropoff /* , needId */ ) => {
  const origin = {
    lat: vehicle.coords.lat,
    long: vehicle.coords.long
  };
  let newBid = randomBid(origin, pickup, dropoff);
  newBid.captain_id = vehicle.id;
  // const newBidId = await saveBid(newBid, needId);
  // newBid.id = newBidId;
  return newBid;
};


async function onNeed(need) {
  const pickup = {
    lat: parseFloat(need.pickup_latitude),
    long: parseFloat(need.pickup_longitude)
  };
  const dropoff = {
    lat: parseFloat(need.dropoff_latitude),
    long: parseFloat(need.dropoff_longitude)
  };

  const vehiclesToBid = findVehicles(10, pickup, 1000);

  vehiclesToBid.forEach(async (vehicle) => {
    const generatedBid = await generateBidFromVehicle(vehicle, pickup, dropoff, need.id);
    const bid = await dav.bid().forNeed(need.id, generatedBid);

    bid.subscribe(
      onBidUpdated,
      err => console.log(err),
      () => console.log('Bid completed')
    );

    function onBidUpdated(bid) {
      if (bid.status === 'awarded') {
        const contract = dav.contract().forBid(bid.id, {
          id: '0x98782738712387623876',
          ttl: 240
        });
        contract.subscribe(
          onContractUpdated,
          err => console.log(err),
          () => console.log('Contract completed')
        );
      }
    }


    function onContractUpdated(contract) {
      switch (contract.status) {
        case 'signed':
          beginMission(contract);
          break;
        case 'fullfilled':
          console.log('We got some money! Hurray!');
          break;
      }
    }


    function beginMission(contract) {
      const missionSubject = dav.mission().begin(contract.bid_id, {
        id: '0x98782738712387623876',
        longitude: vehicle.coords.long,
        latitude: vehicle.coords.lat
      });

      missionSubject.subscribe(
        onMissionUpdated,
        err => console.log(err),
        () => console.log('Mission completed')
      );
    }


    async function onMissionUpdated(currentMissionInstance) {
      currentMissionInstance.update({
        status: '',
        longitude: 1,
        latitude: 1
      });
      // previousMissionInstance = currentMissionInstance;
    }
  });
}

app.use(cors);
app.use(bodyParser.json());

app.get('/healthy', (req, res) => {
  res.send('hello world');
});

function generateNewVehicles(count, coords, radius) {
  let newVehicles = generateRandomVehicles(count, coords, radius);
  addVehicles(newVehicles);
  newVehicles.forEach(vehicle => {
    dav.initCaptain(vehicle);
  });
  return newVehicles;
}

function findVehicles(count, coords, radius) {
  const vehiclesInRange = getVehicles(count, coords, radius);
  if (vehiclesInRange.length < count) {
    let newVehicles = generateNewVehicles(count - vehiclesInRange.length, coords, radius);
    vehiclesInRange.splice(0, 0, ...newVehicles);
  }
  return vehiclesInRange;
}

app.post('/simulation/drones', async (req, res) => {
  const coords = {};
  coords.lat = req.body.latitude;
  coords.long = req.body.longitude;

  const count = 100;
  const radius = 7000;
  const vehiclesInRange = findVehicles(count, coords, radius);

  res.status(200).json(vehiclesInRange);
});

app.listen(port, hostname, () => {
  console.log(`Web server started. Listening on ${hostname}:${port}`);
});
