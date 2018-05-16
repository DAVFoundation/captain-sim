all:

build:
	@docker-compose build

up: build
	@docker-compose up

up-bg: build
	@docker-compose up -d

create-aws-stg-env:
	@eb init captain-sim
	@eb create captain-sim-stg --cname captain-sim-stg -k captain-sim-key

deploy-aws-stg-env:
	@eb deploy --profile eb-cli-dav --staged

down:
	@docker-compose down
