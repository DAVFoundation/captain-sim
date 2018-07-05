if (process.env.NODE_ENV === 'development') require('dotenv').config();

const Rx = require('rxjs/Rx');
const express = require('express');
const bodyParser = require('body-parser');
const mnemonic = require('../mnemonic');
const cors = require('./cors');
// const {registerNew} = require('./web3');
const {
  generateRandomVehicles,
  getVehicles,
  randomBid,
  addVehicles
} = require('./simulation/vehicles');
const {
  generateRandom
} = require('./simulation/drone');
const app = express();
const {
  DavSDK
} = require('dav-js');

const port = process.env.CAPTAIN_PORT || 8887;
const hostname = process.env.CAPTAIN_HOSTNAME || '0.0.0.0';

// setTimeout(init, 5000);
init().catch(err => {
  console.log(err);
});

async function init() {
  const captain = generateRandom({
    coords: {
      lat: 0,
      long: 0
    },
    radius: 1000
  });
  // captain.id=registerNew();
  const dav = new DavSDK(captain.id, captain.id, mnemonic);
  dav.initCaptain(captain);

  const droneDelivery = dav.needs().forType('drone_delivery', {
    global: true,
    ttl: 120
  });

  droneDelivery.subscribe(
    onNeed,
    err => console.log(err),
    () => console.log('completed')
  );

  let missionContract = dav.mission().contract();
  missionContract.subscribe(
    mission => onContractUpdated(mission),
    err => console.log(err),
    () => console.log(''));

  function onContractUpdated(mission) {
    beginMission(mission.captain_id, mission.mission_id);
  }

  async function beginMission(vehicleId, missionId) {
    const missionUpdates = Rx.Observable.timer(0, 1000)
      .mergeMap(async () => {
        let mission = await dav.getMission(missionId);
        let vehicle = await dav.getCaptain(mission.captain_id);
        return {
          mission,
          vehicle
        };
      })
      .distinctUntilChanged(
        (state1, state2) =>
          state1.mission.status === state2.mission.status && state1.vehicle.status === state2.vehicle.status)
      .subscribe(
        async (state) => {
          try {
            switch (state.mission.status) {
              case 'awaiting_signatures':
                break;
              case 'in_progress':
                await onInProgress(
                  state.mission,
                  state.vehicle,
                );
                break;
              case 'in_mission':
                await onInMission(
                  state.mission,
                  state.vehicle,
                );
                break;
              case 'confirmed':
                setTimeout(async () => {
                  await updateStatus(state.mission, 'completed', 'available');
                }, 3000);
                await dav.updateMission(state.mission.mission_id, {
                  status: 'completed',
                  captain_id: state.vehicle.id
                });
                break;
              case 'completed':
                missionUpdates.unsubscribe();
                break;
              default:
                console.log(`bad mission.status ${state.mission}`);
                break;
            }
          } catch (error) {
            console.error(error);
          }
        },
        error => {
          console.error(error);
        }
      );
  }
  async function onInProgress(mission, vehicle) {
    await updateStatus(mission, 'vehicle_signed', 'contract_received');
    await dav.updateMission(mission.mission_id, {
      status: 'in_mission',
      // longitude: droneState.location.lon,
      // latitude: droneState.location.lat,
      captain_id: vehicle.id
    });

    await onInMission(mission, vehicle);
  }
  async function updateStatus(mission, missionStatus, vehicleStatus) {
    await dav.updateMission(mission.mission_id, {
      mission_status: missionStatus,
      vehicle_status: vehicleStatus,
      captain_id: mission.captain_id
    });
  }

  async function moveDrone(srcLat, srcLon, targetLat, targetLon, vehicle, stepProgress, totalProgress, mission, missionStatus, vehicleStatus) {
    Rx.Observable.interval(stepProgress)
      .map(count => count * stepProgress)
      .takeWhile(count => count < totalProgress)
      .map(count => count * 1.0 / totalProgress)
      .mergeMap(async progress => {
        const totalLat = targetLat - srcLat;
        const totalLon = targetLon - srcLon;
        const lat = srcLat + totalLat * progress;
        const lon = srcLon + totalLon * progress;
        vehicle.coords = {
          long: lon,
          lat: lat
        };
        vehicle.ttt={lat,lon};
        return vehicle;
      })
      .subscribe(async vehicle => {
        await dav.updateCaptain(vehicle);
      },
      err => {
        console.log(err);
      },
      async () => {
        await updateStatus(mission, missionStatus, vehicleStatus);
      });
  }

  async function onInMission(mission, vehicle) {
    switch (vehicle.status) {
      case 'contract_received':
        setTimeout(async () => {
          await updateStatus(mission, 'takeoff_start', 'takeoff_start');
        }, 100);
        break;
      case 'takeoff_start':
        setTimeout(async () => {
          await updateStatus(mission, 'travelling_pickup', 'travelling_pickup');
        }, 100);
        break;
      case 'travelling_pickup':
        moveDrone(
          vehicle.coords.lat,
          vehicle.coords.long,
          parseFloat(mission.pickup_latitude),
          parseFloat(mission.pickup_longitude),
          vehicle,100,mission.time_to_pickup,mission,'landing_pickup', 'landing_pickup');
        break;
      case 'landing_pickup':
        setTimeout(async () => {
          await updateStatus(mission, 'waiting_pickup', 'waiting_pickup');
        }, 100);
        break;
      case 'waiting_pickup':
        console.log(`drone waiting for pickup`);
        break;
      case 'takeoff_pickup':
        await updateStatus(
          mission,
          'takeoff_pickup_wait',
          'takeoff_pickup_wait'
        );
        break;
      case 'takeoff_pickup_wait':
        setTimeout(async () => {
          await updateStatus(mission, 'travelling_dropoff', 'travelling_dropoff');
        }, 100);
        break;
      case 'travelling_dropoff':
        moveDrone(
          parseFloat(mission.pickup_latitude),
          parseFloat(mission.pickup_longitude),
          parseFloat(mission.dropoff_latitude),
          parseFloat(mission.dropoff_longitude),
          vehicle,100,mission.time_to_dropoff,mission,'landing_dropoff', 'landing_dropoff');
        break;
      case 'landing_dropoff':
        setTimeout(async () => {
          await updateStatus(
            mission,
            'waiting_dropoff',
            'waiting_dropoff'
          );
        }, 100);
        break;
      case 'waiting_dropoff':
        setTimeout(async () => {
          await updateStatus(mission, 'ready', 'ready');
        }, 100);
        break;
      case 'ready':
        break;
      case 'available':
        await dav.updateMission(mission.mission_id, {
          status: 'completed',
          captain_id: vehicle.id
        });
        break;
      default:
        console.log(`bad vehicle.status ${vehicle}`);
        break;
    }
  }

  const generateBidFromVehicle = async (vehicle, pickup, dropoff /* , needId */ ) => {
    const origin = {
      lat: vehicle.coords.lat,
      long: vehicle.coords.long
    };
    let newBid = randomBid(origin, pickup, dropoff);
    newBid.captain_id = vehicle.id;
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
      /* const bid =  */
      await dav.bid().forNeed(need.id, generatedBid);

      /*  bid.subscribe(
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
        } */
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
      // vehicle.id=registerNew();
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

    const count = 10;
    const radius = 7000;
    const vehiclesInRange = findVehicles(count, coords, radius);

    res.status(200).json(vehiclesInRange);
  });

  app.listen(port, hostname, () => {
    console.log(`Web server started. Listening on ${hostname}:${port}`);
  });
}
