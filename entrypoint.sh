#!/bin/bash

# Start pcscd in the background
/usr/sbin/pcscd --debug --foreground &

# Give pcscd some time to start
sleep 2

# Debugging: List USB devices and check pcscd status
lsusb
ps aux | grep pcscd

# Start the Node.js application
exec "$@"
