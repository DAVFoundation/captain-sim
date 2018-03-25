if (process.env.NODE_ENV === 'development') require('dotenv').config()

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const davJS = require('dav.js');
const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || "0.0.0.0";
const SimulationController = require('./controllers/SimulationController');
const {getVehiclesInRange} = require('./store/vehicles');
const {generateBidFromVehicle} = require('./store/bids');

const dav = new davJS('CAP-SIM');

const droneDelivery = dav.needs().forType('drone_delivery', {global: true});

droneDelivery.subscribe(
  onNeedTypeRegistered,
  err => console.log(err),
  () => console.log('completed')
);

async function onNeedTypeRegistered(need) {
  let vehiclesToBid = await getVehiclesInRange({long: need.pickup_longitude, lat: pickup_latitude}, 7000);
  vehiclesToBid = vehiclesToBid.slice(0, 10);
  vehiclesToBid.forEach(async (vehicle) => {
    const pickup = {lat: pickup_latitude, long: pickup_longitude};
    const dropoff = {lat: dropoff_latitude, long: dropoff_longitude};
    const generatedBid = await generateBidFromVehicle(vehicle, pickup, dropoff, need.id);
    const bid = dav.bid().forNeed(need.id, generatedBid);

    bid.subscribe(
      onBidUpdated,
      err => console.log(err),
      () => console.log('Bid completed')
    )

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
    };


    function onContractUpdated(contract) {
      switch (contract.status) {
        case 'signed':
          beginMission(contract);
          break;
        case 'fullfilled':
          console.log('We got some money! Hurray!');
          break;
      }
    };


    function beginMission(contract){
      const mission = dav.mission().begin(contract.bid_id, {
        id: '0x98782738712387623876',
        longitude: vehicle.coords.long,
        latitude: vehicle.coords.lat
      });
      mission.subscribe(
        onMissionUpdated,
        err => console.log(err),
        () => console.log('Mission completed')
      )
    };


    function onMissionUpdated(mission){
      console.log(mission);

      // TODO: vehicle movement simulation
      // mission.update({
      //   status: 'movingToPickup',
      //   longitude: 3.385048,
      //   latitude: 6.497742
      // });
    }
  });
}







app.use(bodyParser.json());

app.get('/healthy', (req, res) => {
  res.send('hello world');
});


app.post('/simulation/drones', SimulationController.createSimulationDrones)

app.listen(port, hostname, () => {
  console.log(`Web server started. Listening on ${hostname}:${port}`);
});
