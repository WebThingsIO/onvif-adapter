/**
 * ONVIF camera adapter.
 */
'use strict';

const {Adapter, Database} = require('gateway-addon');
const OnvifManager = require('onvif-nvt');
const OnvifDevice = require('./onvif-device');
const {URL} = require('url');

OnvifManager.add('discovery');

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
    this.addKnownDevices();
    this.startPairing();
  }

  /**
   * Attempt to add any configured devices.
   */
  addKnownDevices() {
    for (const cd of this.config.devices) {
      if (!cd.address || !cd.username || !cd.password) {
        continue;
      }

      if (this.knownDevices.has(cd.address)) {
        continue;
      }

      const url = new URL(cd.address);
      OnvifManager.connect(
        url.hostname,
        url.port,
        cd.username,
        cd.password
      ).then((camera) => {
        const data = {
          name: camera.deviceInformation.Name,
        };
        camera.core.getScopes().then((response) => {
          data.scopes =
            response.data.GetScopesResponse.Scopes.map((s) => s.ScopeItem);

          const nvt = 'onvif://www.onvif.org/type/Network_Video_Transmitter';
          if (!data.scopes.includes(nvt)) {
            return;
          }

          const dev = new OnvifDevice(this, data, camera, cd.username,
                                      cd.password);
          this.handleDeviceAdded(dev);

          this.knownDevices.add(cd.address);
        });
      }).catch((e) => {
        console.error(
          `Failed to initialize device at ${cd.service}: ${e}`
        );
      });
    }
  }

  /**
   * Start the discovery process.
   */
  startPairing() {
    if (this.pairing) {
      return;
    }

    this.pairing = true;
    OnvifManager.discovery.startProbe().then((deviceList) => {
      OnvifManager.discovery.stopProbe();

      const database = new Database(this.packageName);
      const promise = database.open();

      for (const device of deviceList) {
        if (!device.types.includes('dn:NetworkVideoTransmitter') &&
            !device.types.includes('tdn:NetworkVideoTransmitter')) {
          continue;
        }

        if (this.knownDevices.has(device.service)) {
          continue;
        }

        let found = false;
        for (const cd of this.config.devices) {
          if (device.urn === cd.urn || device.service === cd.address) {
            found = true;

            if (!cd.username || !cd.address) {
              break;
            }

            const url = new URL(device.service);
            OnvifManager.connect(
              url.hostname,
              url.port,
              cd.username,
              cd.password
            ).then((camera) => {
              const dev = new OnvifDevice(this, device, camera, cd.username,
                                          cd.password);
              this.handleDeviceAdded(dev);
            }).catch((e) => {
              console.error(
                `Failed to initialize device at ${cd.service}: ${e}`
              );
            });

            this.knownDevices.add(device.service);
            break;
          }
        }

        if (!found) {
          // If the device was not configured, save a config stub for the user.
          this.config.devices.push({
            address: device.service,
            username: '',
            password: '',
            urn: device.urn,
            note: device.name,
          });

          promise.then(() => {
            return database.saveConfig(this.config);
          }).catch((e) => {
            console.error(`Error saving config: ${e}`);
          });
        }
      }

      this.pairing = false;
    });
  }

  /**
   * Cancel the pairing process.
   */
  cancelPairing() {
    this.pairing = false;
  }

  /**
   * Remove a device from this adapter.
   *
   * @param {Object} device - The device to remove
   * @returns {Promise} Promise which resolves to the removed device.
   */
  removeThing(device) {
    this.knownDevices.delete(device.camera.serviceAddress.href);
    if (this.devices.hasOwnProperty(device.id)) {
      this.handleDeviceRemoved(device);
    }

    return Promise.resolve(device);
  }

  /**
   * Unload this adapter.
   *
   * @returns {Promise} Promise which resolves when unloading has completed.
   */
  unload() {
    for (const id in this.devices) {
      this.devices[id].transcodeRestart = false;
      this.devices[id].stopTranscode();
    }
    return Promise.resolve();
  }
}

module.exports = OnvifAdapter;
