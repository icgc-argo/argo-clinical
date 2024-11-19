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

import mysql from 'mysql2/promise';
import { RxNormConcept, RxNormService } from './api';
import { getPool } from './pool';

// we take the first one orderd alphabetically
const rxcuiQuery = 'select RXCUI, STR from RXNCONSO where RXCUI = ? order by STR asc';

type RxNormRecord = { RXCUI: string; STR: string };

class MysqlRxNormService implements RxNormService {
	async lookupByRxcui(rxcui: string): Promise<RxNormConcept[]> {
		const pool = getPool();
		const formattedQuery = mysql.format(rxcuiQuery, [rxcui]);

		const connection = await pool.getConnection();
		const [result] = await connection.query(formattedQuery);
		pool.releaseConnection(connection);

		if (Array.isArray(result)) {
			const records = result as RxNormRecord[];
			return records.map((r) => ({
				rxcui: r['RXCUI'],
				str: r['STR'],
			}));
		} else {
			return new Array<RxNormConcept>();
		}
	}
}

export default new MysqlRxNormService();
