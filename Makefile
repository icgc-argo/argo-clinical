
debug:
	docker-compose up -d
	npm run watch-debug

stop:
	docker-compose down --remove-orphans 

register:
	curl -X POST \
	http://localhost:3000/submission/ \
	-H 'Content-Type: application/json' \
	-H 'cache-control: no-cache' \
	-d '{"hey": "hi"}' 