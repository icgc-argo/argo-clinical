# use this to start docker + debugger 
all: dcompose populate-rxnorm
	npm run debug

# use this to just start debbugger
# this is useful to avoid the slow wait in starting up the docker compose file.
debug:
	npm run debug

#run the docker compose file
dcompose:
	docker-compose -f compose/docker-compose.yaml up -d
	# we need to sleep for db containers to start
	sleep 10

# run the scripts to populate sample rxnorm in mysql db
populate-rxnorm:
	docker container exec -w "/var/lib/mysql-files/" clinical_rxnormdb "/bin/sh" ./populate_mysql_rxn.sh

# run all tests
verify:
	npm run test

test-submission:
	npx mocha --exit --timeout 30000 -r ts-node/register test/integration/submission/submission.spec.ts

stop:
	docker-compose  -f compose/docker-compose.yaml down --remove-orphans 

# stop db and delete clinical db only 
purge:
	docker-compose -f compose/docker-compose.yaml down
	# we don't want to remove the rxnorm import
	docker volume rm clinical_db_vol

# delete. everything.
nuke:
	docker-compose  -f compose/docker-compose.yaml down --volumes --remove-orphans 
