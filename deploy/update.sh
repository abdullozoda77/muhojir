#!/usr/bin/env bash
# Updates Muhojir (FastAPI) on the server to the latest code (main). Run as root:
#   bash /home/romin/muhojir-api/deploy/update.sh
set -euo pipefail
sudo -u romin -H git -C /home/romin/muhojir-api pull --ff-only
exec bash /home/romin/muhojir-api/deploy/setup.sh
