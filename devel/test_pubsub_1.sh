#!/bin/bash

set -ex

curl -X POST -H "Content-type: application/json" -d "{\"type\": \"subscribe\", \"channel\" : \"channel1\", \"timeoutMsec\": 10000}" "localhost:4004"