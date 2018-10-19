/**
 * ONVIF camera adapter.
 */
'use strict';

const {Adapter, Database} = require('gateway-addon');
const onvif = require('node-onvif');
const OnvifDevice = require('./onvif-device');

/**
 * Adapter for ONVIF camera devices.
 */
class OnvifAdapter extends Adapter {
  /**
   * Initialize the object.
   *
   * @param {Object} addonManager - AddonManagerProxy object
   * @param {Object} manifest - Package manifest
   */
  constructor(addonManager, manifest) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);

    this.knownDevices = new Set();
    this.config = manifest.moziot.config;

    this.pairing = false;
    this.startPairing();
  }

  /**
   * Start the discovery process.
   */
  startPairing() {
    if (this.pairing) {
      return;
    }

    this.pairing = true;
    onvif.startProbe().then((deviceList) => {
      const database = new Database(this.packageName);
      const promise = database.open();

      for (const device of deviceList) {
        if (!device.types.includes('dn:NetworkVideoTransmitter') &&
            !device.types.includes('tdn:NetworkVideoTransmitter')) {
          continue;
        }

        if (this.knownDevices.has(device.urn)) {
          continue;
        }

        let found = false;
        for (const cd of this.config.devices) {
          if (device.xaddrs.includes(cd.xaddr)) {
            found = true;

            const camera = new onvif.OnvifDevice({
              xaddr: cd.xaddr,
              user: cd.username,
              pass: cd.password,
            });

            camera.init().then(() => {
              const dev = new OnvifDevice(this, device, camera);
              this.handleDeviceAdded(dev);
            }).catch((e) => {
              console.log(`Failed to initialize device at ${cd.xaddr}: ${e}`);
            });
            break;
          }
        }

        if (!found) {
          // If the device was not configured, save a config stub for the user.
          this.config.devices.push({
            xaddr: device.xaddrs[0],
            username: '',
            password: '',
            note: device.name,
          });

          promise.then(() => {
            return database.saveConfig(this.config);
          }).catch((e) => {
            console.error(`Error saving config: ${e}`);
          });
        }

        this.knownDevices.add(device.urn);
      }
    });
  }

  /**
   * Cancel the pairing process.
   */
  cancelPairing() {
    this.pairing = false;
  }
}

module.exports = OnvifAdapter;
