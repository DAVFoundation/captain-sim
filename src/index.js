if (process.env.NODE_ENV === 'development') require('dotenv').config()

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const davJS = require('dav.js');
const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || "0.0.0.0";
const SimulationController = require('./controllers/SimulationController');
const {getVehiclesInRange, getLatestPositionUpdate, getPosition, updateVehiclePosition} = require('./store/vehicles');
const {generateBidFromVehicle} = require('./store/bids');
const {calculateNextCoordinate} = require('./simulation/vehicles');

const dav = new davJS('CAP-SIM');

const droneDelivery = dav.needs().forType('drone_delivery', {global: true});
let previousMissionInstance;

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
      )
    };


    async function onMissionUpdated(currentMissionInstance) {
      const statusWordArray = currentMissionInstance.status.match(/[A-Z][a-z]+/g);
      const leg = statusWordArray[statusWordArray.length - 1].toLowerCase();
      const latestPositionUpdate = await getLatestPositionUpdate(vehicle);
      const positionLastUpdatedAt = latestPositionUpdate[1];
      const previousPosition = await getPosition(latestPositionUpdate[0]);
      const newCoords = await calculateNextCoordinate(currentMissionInstance.vehicle, currentMissionInstance, leg, positionLastUpdatedAt, previousPosition)
      if (!(isNaN(newCoords.long) || isNaN(newCoords.lat))) {
        await updateVehiclePosition(vehicle, newCoords.long, newCoords.lat);
      }
      let newStatus = currentMissionInstance.status;
      if ((currentMissionInstance.vehicle.coords.long === previousMissionInstance.vehicle.coords.long) && (currentMissionInstance.vehicle.coords.lat === previousMissionInstance.vehicle.coords.lat)) {
        newStatus = `at${capitalizeFirstLetter(leg)}`;
      }
      currentMissionInstance.update({
        status: newStatus,
        longitude: newCoords.long,
        latitude: newCoords.lat
      });
      previousMissionInstance = currentMissionInstance;
    }
  });
}


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

app.use(bodyParser.json());

app.get('/healthy', (req, res) => {
  res.send('hello world');
});


app.post('/simulation/drones', SimulationController.createSimulationDrones)

app.listen(port, hostname, () => {
  console.log(`Web server started. Listening on ${hostname}:${port}`);
});
