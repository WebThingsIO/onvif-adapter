const {Property} = require('gateway-addon');

class OnvifProperty extends Property {
  /**
   * ONVIF property type.
   *
   * @param {Object} device - Device this property belongs to
   * @param {string} name - Name of this property
   * @param {Object} descr - Property description metadata
   * @param {*} value - Current property value
   */
  constructor(device, name, descr, value) {
    super(device, name, descr);
    this.setCachedValue(value);
  }

  setValue(value) {
    switch (this.name) {
      case 'streamActive':
        if (value) {
          this.device.startTranscode();
        } else {
          this.device.stopTranscode();
        }

        this.setCachedValueAndNotify(value);
        break;
      case 'highQuality':
      case 'profile': {
        this.setCachedValueAndNotify(value);

        const activeProp = this.device.findProperty('streamActive');
        if (activeProp.value) {
          this.device.stopTranscode();
          this.device.startTranscode();
        }
        break;
      }
      default:
        return super.setValue(value);
    }

    return Promise.resolve(this.value);
  }
}

module.exports = OnvifProperty;
