# onvif-adapter

ONVIF Profile S device adapter for Mozilla IoT Gateway

# Supported Devices

All ONVIF Profile S should be supported. Right now, only video streams, snapshots, and basic PTZ controls are exposed.

## Tested and Working

* [Foscam R2](https://www.foscam.com/R2.html)

# Installation

This add-on can be installed through the UI, via _Settings -> Add-ons -> +_.

# Configuration

When new devices are detected, they are added to the add-on's config with a blank username/password entry. Therefore, to configure each device's credentials, do the following:

1. Start a search for new devices from the _Things_ screen.
2. After the search has completed, navigate to _Settings -> Add-ons_.
3. Click on the _Configure_ button for the ONVIF add-on.
4. Any new devices should be auto-populated in the _devices_ list. Fill in the username and password for each as required.
5. Click _Apply_.
6. After a few seconds, go back to the _Things_ screen and start a new search again.
7. If everything went well, your devices should now be available.
