const config = {
  vehicles_ttl: 86400
};

module.exports = key => {
  if (!(key in config)) {
    throw `The given key "${key}" to config was invalid`;
  } else {
    return config[key];
  }
};
