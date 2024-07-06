#!/bin/bash
set -e

# Start the PCSC daemon
/etc/init.d/pcscd start

# Run the main application
exec "$@"
