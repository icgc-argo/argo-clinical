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
import { Errors } from '../utils';

// types
export type Success<T> = { success: true; exception: T };
export type Failure = { success: false; message: string; errors?: any };
export type Result<T> = Success<T> | Failure;

// helpers
export const success = <T>(data: T): Success<T> => ({ success: true, exception: data });
export const failure = (message: string, errors?: any): Failure => ({
  success: false,
  message,
  errors,
});

// middleware
export const ExceptionErrorHandler = (err: any, req: any, res: any, next: any) => {
  const defaultErrorMessage = `Cannot create exceptions for entity in program '${req.params.programId}'`;

  if (err instanceof ValidationError) {
    const message = `${defaultErrorMessage}. Validation errors in exceptions file.`;
    return res.status(400).send(failure(message, err.data));
  }

  res.status(404).send(failure(err.message || defaultErrorMessage));

  next(err);
};

// errors
export class ValidationError extends Error {
  data: ValidationError[];
  constructor(errors: any) {
    super();
    this.name = this.constructor.name;
    this.data = errors;
  }
}

export class DatabaseError extends Error {
  constructor(message?: string, cause: RepoError = RepoError.SERVER_ERROR) {
    super(message || 'Failed to save exception.');
    this.name = this.constructor.name;

    if (cause === RepoError.DOCUMENT_UNDEFINED)
      this.message = 'Failed to save exception. Document is undefined';
  }
}

export class ExceptionTSVError extends Errors.TSVParseError {
  constructor(message?: string) {
    super(message || 'TSV parsing error.');
    this.name = this.constructor.name;
  }
}
