/*
 * Copyright (c) 2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

pipeline {
    agent {
        kubernetes {
      yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: node
    image: node:12.6.0
    tty: true
    env:
    - name: DOCKER_HOST
      value: tcp://localhost:2375
  securityContext:
    runAsUser: 1000
'''
        }
    }

    environment {
      slackNotificationsUrl = credentials('JenkinsFailuresSlackChannelURL')
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
    }

    post {
      always {
        container('node') {
          script {
            blah = null
            if (env.BRANCH_NAME == 'jenkins') {
            sh "curl -vX POST -H 'Content-type: application/json' --data '{\"text\":\"Build tested: ${env.JOB_NAME} [${env.BUILD_NUMBER}] (${env.BUILD_URL}) \"}' ${slackNotificationsUrl}"
            }
          }
        }
      }
    }
}
