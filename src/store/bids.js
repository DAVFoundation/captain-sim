const redis = require('./redis');
const {randomBid} = require('../simulation/vehicles');

const generateBidFromVehicle = async (vehicle, pickup, dropoff, needId) => {
  const origin = {lat: vehicle.coords.lat, long: vehicle.coords.long};
  let newBid = randomBid(origin, pickup, dropoff);
  newBid.vehicle_id = vehicle.id;
  const newBidId = await saveBid(newBid, needId);
  newBid.id = newBidId;
  return newBid;
};

const saveBid = async ({vehicle_id, time_to_pickup, time_to_dropoff, price, price_type, price_description, expires_at}, needId) => {
  // get new unique id for bid
  const bidId = await redis.incrAsync('next_bid_id');

  // Save bid id in need_bids
  redis.rpushAsync(`need_bids:${needId}`, bidId);

  // Add bid to bids
  redis.hmsetAsync(`bids:${bidId}`,
    'id', bidId,
    'vehicle_id', vehicle_id,
    'price', price,
    'price_type', price_type,
    'price_description', price_description,
    'expires_at', expires_at,
    'time_to_pickup', time_to_pickup,
    'time_to_dropoff', time_to_dropoff,
    'need_id', needId,
  );

  // Set TTL for bid
  setBidTTL(bidId);
  return bidId;
};

module.exports = {generateBidFromVehicle}