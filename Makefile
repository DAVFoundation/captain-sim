FORCE:

build: FORCE
	@rsync -a ../dav-js build
	@rm -rf ../dav-js/node_module
	@docker-compose build

up: build
	@docker-compose up

up-bg: build
	@docker-compose up -d

create-aws-stg-env: FORCE
	@eb init captain-sim
	@eb create captain-sim-stg --cname captain-sim-stg -k captain-sim-key

deploy-aws-stg-env: FORCE
	@eb deploy --staged

down: FORCE
	@docker-compose down
