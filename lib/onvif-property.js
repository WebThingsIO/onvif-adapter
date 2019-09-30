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
    if (this.name !== 'streamActive') {
      return super.setValue(value);
    }

    this.setCachedValueAndNotify(value);
    if (this.value) {
      this.device.startTranscode();
    } else {
      this.device.stopTranscode();
    }

    return Promise.resolve(this.value);
  }
}

module.exports = OnvifProperty;
