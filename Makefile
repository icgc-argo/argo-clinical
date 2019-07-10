
debug:
	docker-compose up -d
	npm run debug

verify:
	npm run test

stop:
	docker-compose down --remove-orphans 

# curl file upload relative path
registration-upload:
	pwd
	# todo check why this doesn't work 
	curl -v -X POST \
	http://localhost:3000/submission/registration/ \
	-H 'cache-control: no-cache' \
	-H 'content-type: multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW' \
	-F programId=PEME-CA \
	-F creator=bashar \
	-F 'registrationFile=@/home/ballabadi/dev/repos/argo/argo-clinical/sampleFiles/registration.tsv'

registration-get:
	curl -X GET \
	'http://localhost:3000/submission/registration?programId=PEME-CA' \
	-H 'cache-control: no-cache'