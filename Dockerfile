FROM node:9.3.0

RUN npm install -g nodemon

WORKDIR /app

COPY package.json /app/
RUN npm install

COPY . /app

CMD [ "npm", "start" ]

EXPOSE 8080
