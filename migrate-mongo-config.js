/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
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

// In this file you can configure migrate-mongo
let auth = undefined;
if (process.env.CLINICAL_DB_USERNAME && process.env.CLINICAL_DB_PASSWORD) {
  auth = {
    user: process.env.CLINICAL_DB_USERNAME,
    password: process.env.CLINICAL_DB_PASSWORD,
  };
}

const config = {
  mongodb: {
    url: process.env.CLINICAL_DB_URL,
    databaseName: 'clinical',
    options: {
      auth: auth,
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
    },
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: 'migrations',

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: 'changelog',
};

// create secure version of config to log
const configCopy = JSON.parse(JSON.stringify(config)); // a hack to deep copy
if (configCopy.mongodb.options.auth) {
  console.log('hiding auth..');
  configCopy.mongodb.options.auth.user = configCopy.mongodb.options.auth.user.length;
  configCopy.mongodb.options.auth.password = configCopy.mongodb.options.auth.password.length;
}
console.log(JSON.stringify(configCopy));

// Return the config as a promise
module.exports = config;
