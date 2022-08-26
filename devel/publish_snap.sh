#!/bin/bash

set -ex

rm dist/*.snap
rm dist/*.AppImage
yarn electron:build
snapcraft upload --release=edge dist/*.snap