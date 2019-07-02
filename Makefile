
debug:
	docker-compose up -d
	npm run watch-debug

stop:
	docker-compose down --remove-orphans 
	