# onvif-adapter

ONVIF Profile S camera adapter for Mozilla WebThings Gateway.

**NOTE:** Things will be much more painless if your cameras are all given static IP addresses on your network.

# Supported Devices

## Tested and Working

* [Foscam R2](https://www.foscam.com/R2.html)
* SV3C SV-B06W-1080P-HX
* [Amcrest IP3M-941B](https://amcrest.ca/amcrest-ultrahd-2k-3mp-2304tvl-wifi-video-monitoring-security-ip-camera-with-pan-tilt-dual-band-5ghz-2-4ghz-two-way-audio-3-megapixel-2304x1296-at-20fps-wide-90-viewing-angle-and-night-vision-ip3m-941b-black.html)

## Untested but _Should Work_

All other ONVIF Profile S compatible cameras.

# Installation

This add-on can be installed through the UI, via _Settings -> Add-ons -> +_.

**NOTE:** If you are installing this add-on in a gateway you built yourself, your system will need to have [ffmpeg](https://www.ffmpeg.org/) installed.

# Configuration

When new devices are detected, they are added to the add-on's config with a blank username/password entry. Therefore, to configure each device, do the following:

1. Start a search for new devices from the _Things_ screen.
2. After the search has completed, navigate to _Settings -> Add-ons_.
3. Click on the _Configure_ button for the ONVIF add-on.
4. Any new devices should be auto-populated in the _devices_ list. Fill in the username and password for each as required.
5. Click _Apply_.
6. After a few seconds, go back to the _Things_ screen and start a new search again.
7. If everything went well, your devices should now be available.

Additionally, PTZ controls can be optionally enabled.

## Manual Configuration

If your devices were not auto-populated in the configuration screen, but you know the address of the cameras, you can configure them as follows:

1. Launch the config editor by navigating to _Settings -> Add-ons_ and clicking the _Configure_ button for the ONVIF add-on.
2. Add a new entry for your device by clicking _+_ and filling in the fields.
3. Click _Apply_.
4. After a few seconds, go back to the _Things_ screen and start a new search again.
5. If everything went well, your devices should now be available.
