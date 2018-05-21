#!/bin/bash

echo copying dav-js...
cp -R /build/dav-js/. ./build/dav-js

echo installing dav-js...
cd ./build/dav-js && rm -rf node_modules && npm i

echo installing dependencies...
cd ../../
rm -rf node_modules
npm i

echo linking dav-js...
npm link ./build/dav-js

nodemon --inspect=0.0.0.0:9229 src/index.js
