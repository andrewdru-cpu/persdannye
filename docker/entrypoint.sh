#!/bin/sh
# Кэш Next лежит по симлинку в /tmp, чтобы корень контейнера мог быть read-only.
set -eu
mkdir -p /tmp/next-cache
exec node server.js
