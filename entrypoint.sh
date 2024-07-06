#!/bin/bash

# Start the pcscd daemon
/usr/sbin/pcscd -f &

# Execute the provided command (pm2-runtime)
exec "$@"
