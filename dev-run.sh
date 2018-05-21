#!/bin/bash

cp -R /build/dav-js/src/. /app/node_modules/dav-js/src
cp /build/dav-js/package.json ./node_modules/dav-js
cd ./node_modules/dav-js
npm i
cd ../..
nodemon --inspect=0.0.0.0:9229 src/index.js
