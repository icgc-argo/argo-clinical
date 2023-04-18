/*
 * Copyright (c) 2023 The Ontario Institute for Cancer Research. All rights reserved
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

const mean = require('lodash/mean');

const getCoreCompletionPercentage = fields => mean(Object.values(fields || {})) || 0;

const getCoreCompletionDate = (donor, percentage) =>
  percentage === 1 ? donor.updatedAt || new Date().toDateString() : undefined;

const filterUp = {
  completionStats: { $exists: true },
  'completionStats.coreCompletion': { $exists: true },
  'completionStats.coreCompletionDate': { $exists: false },
  'completionStats.coreCompletionPercentage': { $exists: false },
};

const filterDown = {
  completionStats: { $exists: true },
  'completionStats.coreCompletion': { $exists: true },
  'completionStats.coreCompletionDate': { $exists: true },
  'completionStats.coreCompletionPercentage': { $exists: true },
};

module.exports = {
  async up(db, client) {
    try {
      const donors = await db
        .collection('donors')
        .find(filterUp)
        .toArray();

      donors.forEach(donor => {
        const coreCompletionPercentage = getCoreCompletionPercentage(
          donor.completionStats.coreCompletion,
        );
        const coreCompletionDate = getCoreCompletionDate(donor, coreCompletionPercentage);
        donor.completionStats.coreCompletionPercentage = coreCompletionPercentage;
        donor.completionStats.coreCompletionDate = coreCompletionDate;
        db.collection('donors').save(donor);
      });
    } catch (err) {
      console.error('failed', err);
      throw err;
    }
  },

  async down(db, client) {
    try {
      const donors = await db
        .collection('donors')
        .find(filterDown)
        .toArray();

      donors.forEach(donor => {
        delete donor.completionStats.coreCompletionDate;
        delete donor.completionStats.coreCompletionPercentage;
        db.collection('donors').save(donor);
      });
    } catch (err) {
      console.error('failed', err);
      throw err;
    }
  },
};
