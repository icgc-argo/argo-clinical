def commit = "UNKNOWN"

pipeline {
    agent {
        kubernetes {
            label 'clinical-executor'
            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: mhart/alpine-node:latest
    tty: true
  - name: helm
    image: alpine/helm:2.12.3
    tty: true
    command:
    - cat
  - name: docker
    image: docker:18-git
    tty: true
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-sock
  volumes:
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
      type: File
"""
        }
    }
    stages {
        stage('Prepare') {
            steps {
                script {
                    commit = sh(returnStdout: true, script: 'git describe --always').trim()
                }
                script {
                    version = sh(returnStdout: true, script: 'cat package.json | grep version | cut -d \':\' -f2 | sed -e \'s/"//\' -e \'s/",//\'').trim()
                }
            }
        }
        stage('Test') {
            steps {
                container('node') {
                    sh "npm ci %% npm run build"
                }
            }
        }
       // publish the edge tag
        stage('Publish Develop') {
            when {
                branch "develop"
            }
            steps {
                container('docker') {
                    withCredentials([usernamePassword(credentialsId:'argoDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh 'docker login -u $USERNAME -p $PASSWORD'
                    }

                    // the network=host needed to download dependencies using the host network (since we are inside 'docker'
                    // container)
                    sh "docker build --network=host -f Dockerfile . -t icgcargo/clinical:edge -t icgcargo/clinical:${version}-${commit}"
                    sh "docker push icgcargo/clinical:${version}-${commit}"
                    sh "docker push icgcargo/clinical:edge"
               }
            }
        }

        stage('Release & tag') {
          when {
            branch "master"
          }
          steps {
              container('docker') {
                    withCredentials([usernamePassword(credentialsId:'argoDockerHub', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')]) {
                        sh 'docker login -u $USERNAME -p $PASSWORD'
                    }
                    sh "docker  build --network=host -f Dockerfile . -t icgcargo/clinical:latest -t icgcargo/clinical:${version}"
                    sh "docker push icgcargo/clinical:${version}"
                    sh "docker push icgcargo/clinical:latest"
                    withCredentials([usernamePassword(credentialsId: 'argoGithub', passwordVariable: 'GIT_PASSWORD', usernameVariable: 'GIT_USERNAME')]) {
                        sh "git tag ${version}"
                        sh "git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/icgc-argo/argo-clinical --tags"
                    }
             }
          }
        }
    }
}