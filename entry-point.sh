# run pending db migrtions
npx migrate-mongo up
retval=$?

# check failure and roll back
if [ $retval -ne 0 ]; then
    echo "migration up return code was not zero but $retval"
    exit 1
fi

# start clinical service
node dist/src/server.js