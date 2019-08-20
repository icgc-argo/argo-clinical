
fun(){
    RET=1
    until [ ${RET} -eq 0 ]; do
        echo trying to set the secret in vault
        vault kv put secret/clinical/secrets_v1 content='{"CLINICAL_DB_USERNAME": "admin", "CLINICAL_DB_PASSWORD": "password"}'
        RET=$?
        sleep 1
    done
    echo done
}

fun &
vault server -config=/scripts/config.hcl -dev