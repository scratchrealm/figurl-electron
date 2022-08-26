#!/bin/bash

set -ex

curl -X POST -H "Content-type: application/json" -d "{\"type\": \"publish\", \"channel\" : \"channel1\", \"messageBody\": \"wxyz\"}" "localhost:4004"