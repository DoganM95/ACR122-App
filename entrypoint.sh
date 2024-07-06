#!/bin/bash

# Unbind the device from the pn533_usb driver
echo -n "3-2:1.0" >/sys/bus/usb/drivers/pn533_usb/unbind

# Bind the device to the ccid driver
modprobe usbserial vendor=0x072f product=0x2200
echo -n "3-2:1.0" >/sys/bus/usb/drivers/ccid/bind

# Start pcscd in the background
/usr/sbin/pcscd --debug --foreground &

# Give pcscd some time to start
sleep 2

# Debugging: List USB devices and check pcscd status
lsusb
ps aux | grep pcscd

# Start the Node.js application
exec "$@"
