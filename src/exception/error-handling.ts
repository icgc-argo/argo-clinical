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

import { RepoError } from './repo/types';

// types
export type Success<T> = { success: true; data: T };
export type Failure = { success: false; message: string };
export type Result<T> = Success<T> | Failure;

// helpers
export const success = <T>(data: T): Success<T> => ({ success: true, data });

// middleware
export const ExceptionErrorHandler = (err: any, req: any, res: any, next: any) => {
  console.log('Exception --- error handler --- midlleware');
  console.log(JSON.stringify(err));
  res.status(404).send('custom error handler ran');
};

// errors
export class ValidationError extends Error {
  constructor(errors: any) {
    super('message');
    this.name = this.constructor.name;
  }
}

export class DatabaseError extends Error {
  constructor(message?: string, cause?: RepoError) {
    super();
    if (cause === RepoError.DOCUMENT_UNDEFINED) {
      this.message = '';
    } else if (cause === RepoError.SERVER_ERROR) {
      this.message = '';
    }
    this.name = this.constructor.name;
  }
}
