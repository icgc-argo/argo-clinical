# Argo clinical

[![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fargo-clinical%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/argo-clinical/job/master/)

## Requirements:

- node 12+
- Mongo 4.0

## How to:

Make scripts are provided to run this application and the required MongoDB using docker. In order for these scripts to start the dev server, you must have a debugger application waiting to attach on port `9229`. This is easily accomplished by running these commands in the VSCode terminal, and updating the `Debugger Auto Attach` setting in VSCode settings to `yes`.

- run: `make debug`
- tests: `make verify`

To run local without engaging the debugger, run `npm run local` . Since this will not run the docker-compose setup, this requires MongoDB to be running locally (connections configured in the .env file)

## Debugging Notes:

If file upload fails with the error `TypeError: Cannot read property 'readFile' of undefined`, make sure you are running Node 12+

## DB migration

we use tool called migrate-mongo: https://www.npmjs.com/package/migrate-mongo

- create script: `npx migrate-mongo create my-script`
- run migration: `npx migrate-mongo up`
- rollback: `npx migrate-mongo down`
  - With this command, migrate-mongo will revert (only) the last applied migration
- status: `npx migrate-mongo status`

notes:

- you can't change the the contents after the script ran, it wont run again automatically
  - if you need to change the script you have to write another script that does what you want
- the scripts are sorted by date & time
- a collection in db called changelog will keep track of executed scripts.
- the docker image will excute the scripts automatically before starting the server and if fails it runs rollback script and exits
