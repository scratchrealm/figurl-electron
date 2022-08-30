#!/bin/bash

set -ex

rm dist/*.snap
rm dist/*.AppImage
yarn electron:build
snap install --dangerous --devmode dist/*.snap