FROM node:9.3.0-alpine

RUN npm install -g nodemon

COPY package.json /app/

WORKDIR /app

RUN npm install

COPY src/. /app/src

CMD [ "npm", "start" ]

EXPOSE 8080