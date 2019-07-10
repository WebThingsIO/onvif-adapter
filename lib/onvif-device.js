/**
 * ONVIF device type.
 */
'use strict';

const {Device} = require('gateway-addon');
const OnvifProperty = require('./onvif-property');
const {URL} = require('url');
const child_process = require('child_process');
const fs = require('fs');
const mkdirp = require('mkdirp');
const os = require('os');
const path = require('path');

const SNAPSHOT_INTERVAL = 10 * 1000;
const DEBUG = false;

function getMediaPath() {
  let profileDir;
  if (process.env.hasOwnProperty('MOZIOT_HOME')) {
    profileDir = process.env.MOZIOT_HOME;
  } else {
    profileDir = path.join(os.homedir(), '.mozilla-iot');
  }

  return path.join(profileDir, 'media', 'onvif');
}

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
   * @param {boolean} enablePTZ - Whether or not to enable PTZ actions
   */
  constructor(adapter, data, camera, username, password, enablePTZ) {
    const info = camera.getInformation();
    const id = `onvif-${camera.deviceInformation.SerialNumber}`;

    super(adapter, id);
    this.camera = camera;
    this.username = username;
    this.password = password;
    this.name = data.name;
    this.description = `${info.Manufacturer} ${info.Model}`;
    this['@context'] = 'https://iot.mozilla.org/schemas';
    this['@type'] = ['VideoCamera', 'Camera'];

    this.transcodeProcess = null;
    this.transcodeRestart = true;

    const proc = child_process.spawnSync(
      'ffmpeg',
      ['-version'],
      {encoding: 'utf8'}
    );
    const version = proc.stdout.split('\n')[0].split(' ')[2];
    this.ffmpegMajor = parseInt(version.split('.')[0], 10);
    this.ffmpegMinor = parseInt(version.split('.')[1], 10);

    this.mediaDir = path.join(getMediaPath(), this.id);
    if (!fs.existsSync(this.mediaDir)) {
      mkdirp.sync(this.mediaDir, {mode: 0o755});
    }

    camera.add('snapshot');

    const profile = camera.getDefaultProfile();
    if (DEBUG) {
      console.log(JSON.stringify(profile, null, 2));
    }

    if (profile.hasOwnProperty('AudioEncoderConfiguration') ||
        data.scopes.includes('onvif://www.onvif.org/type/audio_encoder')) {
      this.haveAudio = true;
    } else {
      this.haveAudio = false;
    }

    this.streamUrl = new URL(profile.StreamUri.Uri);
    if (this.username) {
      this.streamUrl.username = this.username;
    }
    if (this.password) {
      this.streamUrl.password = this.password;
    }

    const links = [
      {
        rel: 'alternate',
        href: `/media/onvif/${this.id}/index.mpd`,
        mediaType: 'application/dash+xml',
      },
    ];

    if (this.ffmpegMajor >= 4) {
      links.push({
        rel: 'alternate',
        href: `/media/onvif/${this.id}/master.m3u8`,
        mediaType: 'application/vnd.apple.mpegurl',
      });
    }

    this.properties.set(
      'stream',
      new OnvifProperty(
        this,
        'stream',
        {
          '@type': 'VideoProperty',
          label: 'Stream',
          type: 'null',
          readOnly: true,
          links,
        },
        null,
      )
    );

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
              href: `/media/onvif/${this.id}/snapshot.jpg`,
              mediaType: 'image/jpeg',
            },
          ],
        },
        null
      )
    );

    if (camera.ptz && enablePTZ) {
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
                description: 'Horizontal velocity',
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              speedY: {
                description: 'Vertical velocity',
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              speedZ: {
                description: 'Zoom velocity',
                type: 'number',
                minimum: -1.0,
                maximum: 1.0,
              },
              timeout: {
                description: 'Move timeout',
                type: 'number',
                minimum: 0,
                unit: 'second',
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
      this.addAction(
        'home',
        {
          label: 'Go To Home',
        }
      );
    }

    if (DEBUG && camera.events) {
      // TODO: set up events properly
      camera.events.getEventProperties().then(console.log).catch(console.error);

      camera.events.on('messages', (messages) => {
        console.log('Messages Received:', messages);
      });

      camera.events.on('messages:error', (error) => {
        console.error('Messages Error:', error);
      });

      camera.events.startPull();
    }

    setInterval(this.snapshot.bind(this), SNAPSHOT_INTERVAL);
    this.startTranscode();
  }

  /**
   * Take a snapshot.
   *
   * @returns {Promise} Promise which resolves to an Object containining MIME
   *                    type and snapshot buffer.
   */
  snapshot() {
    return this.camera.snapshot.getSnapshot().then((res) => {
      fs.writeFileSync(path.join(this.mediaDir, 'snapshot.jpg'), res.image);
    });
  }

  startTranscode() {
    if (!this.transcodeRestart) {
      return;
    }

    const args = [
      '-y',
      '-i', this.streamUrl.toString(),
      '-fflags', 'nobuffer',
      '-vsync', '0',
      '-copyts',
      '-probesize', '200000',
      '-window_size', '5',
      '-extra_window_size', '10',
      '-use_template', '1',
      '-use_timeline', '1',
    ];

    // ffmpeg 4.x
    if (this.ffmpegMajor >= 4) {
      args.push(
        '-streaming', '1',
        '-hls_playlist', '1'
      );
    }

    // ffmpeg 4.1+
    if (this.ffmpegMajor > 4 ||
        (this.ffmpegMajor === 4 && this.ffmpegMinor >= 1)) {
      args.push(
        // eslint-disable-next-line max-len
        '-format_options', 'movflags=empty_moov+omit_tfhd_offset+frag_keyframe+default_base_moof',
        '-seg_duration', '1',
        '-dash_segment_type', 'mp4'
      );
    }

    args.push(
      '-remove_at_exit', '1',
      '-loglevel', 'quiet'
    );

    const profile = this.camera.getDefaultProfile();
    switch (profile.VideoEncoderConfiguration.Encoding.toLowerCase()) {
      case 'h264':
        args.push('-c:v', 'copy');
        break;
      default:
        args.push('-c:v', 'libx264',
                  '-b:v:0', '800k',
                  '-profile:v:0', 'baseline');
        break;
    }

    if (this.haveAudio) {
      if (profile.hasOwnProperty('AudioEncoderConfiguration')) {
        switch (profile.AudioEncoderConfiguration.Encoding.toLowerCase()) {
          case 'aac':
            args.push('-c:a', 'copy');
            break;
          default:
            args.push('-c:a', 'aac',
                      '-b:a:0', '128k');
            break;
        }
      } else {
        args.push('-c:a', 'aac',
                  '-b:a:0', '128k');
      }
    }

    args.push('-f', 'dash', path.join(this.mediaDir, 'index.mpd'));

    this.transcodeProcess = child_process.spawn('ffmpeg', args);

    this.transcodeProcess.on('close', this.startTranscode.bind(this));
    this.transcodeProcess.on('error', console.error);
    this.transcodeProcess.stdout.on('data', (data) => {
      if (DEBUG) {
        console.log(`ffmpeg: ${data}`);
      }
    });
    this.transcodeProcess.stderr.on('data', (data) => {
      if (DEBUG) {
        console.error(`ffmpeg: ${data}`);
      }
    });
  }

  stopTranscode() {
    if (this.transcodeProcess) {
      this.transcodeProcess.kill();
      this.transcodeProcess = null;
    }
  }

  stopEvents() {
    if (DEBUG && this.camera.events) {
      this.camera.events.stopPull();
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
      case 'home':
        action.start();
        return this.camera.ptz.gotoHomePosition().then(() => {
          action.finish();
        }).catch((e) => {
          console.error(`Failed to move to home position: ${e}`);
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

