#!/usr/bin/env bash
set -euo pipefail
sudo -u romin -H git -C /home/romin/muhojir-api pull --ff-only
exec bash /home/romin/muhojir-api/deploy/setup.sh
