FROM node:9

RUN apt update && apt full-upgrade -yy

RUN npm install -g nodemon

WORKDIR /app

COPY package.json /app/
RUN npm install

COPY . /app

CMD [ "npm", "start" ]

EXPOSE 8080
