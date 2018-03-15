const {getVehiclesInRange} = require('../store/vehicles');


const createSimulationDrones = async (req, res) => {
  const coords = {};
  coords.lat = req.body.latitude;
  coords.long = req.body.longitude;
  const vehicles = await getVehiclesInRange(coords, 7000);
  res.status(200).json(vehicles);
}


module.exports = {createSimulationDrones}
