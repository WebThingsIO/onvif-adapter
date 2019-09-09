'use strict';

const child_process = require('child_process');
const OnvifAdapter = require('./lib/onvif-adapter');

module.exports = (addonManager, manifest, errorCallback) => {
  const proc = child_process.spawnSync(
    'ffmpeg',
    ['-version'],
    {encoding: 'utf8'}
  );
  if (proc.status !== 0) {
    errorCallback(manifest.name, 'ffmpeg is not installed');
    return;
  }

  new OnvifAdapter(addonManager, manifest);
};
