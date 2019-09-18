'use strict';

const child_process = require('child_process');
const manifest = require('./manifest.json');
const OnvifAdapter = require('./lib/onvif-adapter');

module.exports = (addonManager, _, errorCallback) => {
  const proc = child_process.spawnSync(
    'ffmpeg',
    ['-version'],
    {encoding: 'utf8'}
  );
  if (proc.status !== 0) {
    errorCallback(manifest.id, 'ffmpeg is not installed');
    return;
  }

  new OnvifAdapter(addonManager);
};
