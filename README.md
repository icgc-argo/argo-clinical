# Argo clinical

[![Build Status](https://jenkins.qa.cancercollaboratory.org/buildStatus/icon?job=ARGO%2Fargo-clinical%2Fmaster)](https://jenkins.qa.cancercollaboratory.org/job/ARGO/job/argo-clinical/job/master/)

## Requirements:

- node 12+
- Mongo 4.0 + (transaction support)

## How to:

Make scripts are provided to run this application and the required MongoDB using docker. In order for these scripts to start the dev server, you must have a debugger application waiting to attach on port `9229`. This is easily accomplished by running these commands in the VSCode terminal, and updating the `Debugger Auto Attach` setting in VSCode settings to `yes`.

- run: `make debug`
- tests: `make verify`

To run local without engaging the debugger, run `npm run local` . Since this will not run the docker-compose setup, this requires MongoDB to be running locally (connections configured in the .env file)

## Debugging Notes:

If file upload fails with the error `TypeError: Cannot read property 'readFile' of undefined`, make sure you are running Node 12+
