pipeline {
    agent {
        kubernetes {
            label 'jenkins-slave'
            yaml """
            
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: mysql-client
    image: mysql:5.5
    command:
    - cat
    tty: true
    env:
    - name: MYSQL_HOST
      value: ${MYSQL_HOST}
    - name: MYSQL_PASSWORD
      value: ${MYSQL_PASSWORD}
    - name: MYSQL_USER
      value: ${MYSQL_USER}    
    - name: IMPORT_DB_NAME
      value: ${IMPORT_DB_NAME}
      
  - name: curl
    image: byrnedo/alpine-curl
    command:
    - cat
    tty: true
    
  - name: unzip
    image: garthk/unzip
    command:
    - cat
    tty: true
"""
        }
    }

    stages {
        stage('download & unzip file') {
            steps {
                container('curl') {
                    sh 'which curl'
                    sh """
                        curl –o import.zip ${FILE_URL} > import.zip
                    """
                }
                container('unzip') {
                    sh 'ls'
                    sh "unzip -n import.zip"
                }
            }
        }
        stage('import') {
            steps {
                container('mysql-client') {
                    sh 'ls'
                    sh """
                        ./populate_mysql_rxn.sh
                        cat mysql.log
                    """
                }
            }
        }
    }
}