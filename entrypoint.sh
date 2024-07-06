#!/bin/bash

# Start the pcscd daemon
/usr/sbin/pcscd -f -d &

# Execute the provided command (pm2-runtime)
exec "$@"
