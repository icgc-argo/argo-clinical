
fun(){
    RET=1
    until [ ${RET} -eq 0 ]; do
        echo trying to set the secret in vault
        cd /scripts
        vault kv put secret/clinical/secrets_v1 @secrets.json
        RET=$?
        sleep 1
    done
    echo done
}

fun &
vault server -config=/scripts/config.hcl -dev