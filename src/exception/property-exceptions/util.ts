/*
 * Copyright (c) 2024 The Ontario Institute for Cancer Research. All rights reserved
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

import { RepoError } from './error-handling';
import { EntityException, ProgramException, EntityValues, Entity } from './types';
import _ from 'lodash';

export function isProgramException(result: ProgramException | null): result is ProgramException {
	return result?.programId !== undefined;
}

export function isEntityException(result: EntityException | null): result is EntityException {
	return (
		result?.programId !== undefined &&
		(result?.specimen !== undefined ||
			result?.follow_up !== undefined ||
			result?.treatment !== undefined)
	);
}

export function isRepoError(
	result: ProgramException | EntityException | RepoError,
): result is RepoError {
	return result === RepoError.DOCUMENT_UNDEFINED || result === RepoError.SERVER_ERROR;
}

/**
 *
 * @param fileType
 * @returns snaked_cased string
 */
export function normalizeEntityFileType(fileType: string) {
	return _.snakeCase(fileType);
}

/**
 *
 * @param fileType
 * @returns true if valid Entity
 */
export function isValidEntityType(fileType: string): fileType is Entity {
	return Object.keys(EntityValues).includes(fileType);
}
