'use strict';

const OnvifAdapter = require('./lib/onvif-adapter');

module.exports = (addonManager, manifest) => {
  new OnvifAdapter(addonManager, manifest);
};
