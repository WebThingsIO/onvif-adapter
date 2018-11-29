/**
 * ONVIF device type.
 */
'use strict';

const {Device} = require('gateway-addon');
const OnvifProperty = require('./onvif-property');
const {URL} = require('url');

const DEBUG = false;

/**
 * ONVIF device type.
 */
class OnvifDevice extends Device {
  /**
   * Initialize the object.
   *
   * @param {Object} adapter - OnvifAdapter instance
   * @param {Object} data - Discovery data
   * @param {Object} camera - Initialize OnvifDevice object from node-onvif
   * @param {string} username - Camera user
   * @param {string} password - Camera password
   */
  constructor(adapter, data, camera, username, password) {
    let id = data.urn.split(':');
    id = `onvif-${id[id.length - 1]}`;
    const info = camera.getInformation();

    super(adapter, id);
    this.camera = camera;
    this.username = username;
    this.password = password;
    this.urn = data.urn;
    this.name = data.name;
    this.description = `${info.Manufacturer} ${info.Model}`;
    this['@context'] = 'https://iot.mozilla.org/schemas';
    this['@type'] = [];

    camera.add('snapshot');

    const profile = camera.getDefaultProfile();
    if (DEBUG) {
      console.log(JSON.stringify(profile, null, 2));
    }

    let mediaType;
    switch (profile.VideoEncoderConfiguration.Encoding.toLowerCase()) {
      case 'h.264':
      case 'h264':
        mediaType = 'video/h264';
        break;
      case 'mpeg4':
        mediaType = 'video/mp4';
        break;
      case 'jpeg':
        mediaType = 'video/jpeg';
        break;
      default:
        mediaType = 'video/unknown';
        break;
    }

    const streamUrl = new URL(profile.StreamUri.Uri);
    if (this.username) {
      streamUrl.username = this.username;
    }
    if (this.password) {
      streamUrl.password = this.password;
    }

    this.properties.set(
      'stream',
      new OnvifProperty(
        this,
        'stream',
        {
          '@type': 'VideoProperty',
          label: 'Stream URL',
          type: 'null',
          readOnly: true,
          links: [
            {
              rel: 'alternate',
              href: streamUrl.toString(),
              mediaType,
            },
          ],
        },
        null,
      )
    );

    const snapshotUrl = new URL(profile.SnapshotUri.Uri);
    if (this.username) {
      snapshotUrl.username = this.username;
    }
    if (this.password) {
      snapshotUrl.password = this.password;
    }

    this.properties.set(
      'snapshot',
      new OnvifProperty(
        this,
        'snapshot',
        {
          '@type': 'ImageProperty',
          label: 'Snapshot',
          type: 'null',
          readOnly: true,
          links: [
            {
              rel: 'alternate',
              href: snapshotUrl.toString(),
              mediaType: 'image/jpeg',
            },
          ],
        },
        null
      )
    );

    if (camera.ptz) {
      this.addAction(
        'move',
        {
          label: 'Move',
          input: {
            type: 'object',
            required: [
              'speedX',
              'speedY',
              'speedZ',
            ],
            properties: {
              speedX: {
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              speedY: {
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              speedZ: {
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              timeout: {
                type: 'number',
                minimum: 0,
                unit: 'seconds',
              },
            },
          },
        }
      );
      this.addAction(
        'stop',
        {
          label: 'Stop',
        }
      );
    }

    if (camera.events) {
      // TODO: set up events properly
      if (DEBUG) {
        camera.events.getEventProperties().then(console.log);

        camera.events.on('messages', (messages) => {
          console.log('Got events:', messages);
        });

        camera.events.on('messages:error', (error) => {
          console.error(`Messages error: ${error}`);
        });

        camera.events.startPull();
      }
    }
  }

  /**
   * Perform an action.
   *
   * @param {Object} action - Action to perform
   */
  performAction(action) {
    switch (action.name) {
      case 'move': {
        action.start();

        const velocity = {
          x: action.input.speedX,
          y: action.input.speedY,
          z: action.input.speedZ,
        };

        let timeout = null;
        if (typeof action.input.timeout === 'number') {
          timeout = action.input.timeout;
        }

        return this.camera.ptz.continuousMove(null, velocity, timeout)
          .then(() => {
            action.finish();
          }).catch((e) => {
            console.error(`Failed to move camera: ${e}`);
            action.status = 'error';
            this.actionNotify(action);
          });
      }
      case 'stop':
        action.start();
        return this.camera.ptz.stop().then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to stop camera: ${e}`);
          action.status = 'error';
          this.actionNotify(action);
        });
      default:
        action.status = 'error';
        this.actionNotify(action);
        return Promise.resolve();
    }
  }
}

module.exports = OnvifDevice;

