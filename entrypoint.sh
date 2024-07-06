#!/bin/bash

# Start the PC/SC daemon
/usr/sbin/pcscd &

# Ensure the blacklist.conf is in place
if [ ! -f /etc/modprobe.d/blacklist.conf ]; then
    echo "install nfc /bin/false" >>/etc/modprobe.d/blacklist.conf
    echo "install pn533 /bin/false" >>/etc/modprobe.d/blacklist.conf
fi

# Reload udev rules
udevadm control --reload-rules

# Wait for a bit to ensure everything is up and running
sleep 2

# Execute the main process
exec "$@"
