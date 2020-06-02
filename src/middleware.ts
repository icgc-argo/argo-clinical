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

import { NextFunction, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import { loggerFor } from './logger';
import { Errors } from './utils';
const L = loggerFor(__filename);
// multer file upload handler
export const upload = multer({ dest: '/tmp' });

// wrapper to handle errors from async express route handlers
export const wrapAsync = (fn: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    const routePromise = fn(req, res, next);
    if (routePromise.catch) {
      routePromise.catch(next);
    }
  };
};

// general catch all error handler
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): any => {
  L.error('error handler received error: ', err);
  if (res.headersSent) {
    L.debug('error handler skipped');
    return next(err);
  }
  let status: number;
  let customizableMsg = err.message;
  switch (true) {
    case err instanceof Errors.InvalidArgument:
      status = 400;
      break;
    case err instanceof Errors.NotFound:
      status = 404;
      break;
    case err instanceof Errors.StateConflict:
      status = 409;
      break;
    case (err as any).name == 'CastError':
      status = 404;
      err.name = 'Not found';
      customizableMsg = 'Id not found';
      break;
    default:
      status = 500;
  }
  res.status(status).send({ error: err.name, message: customizableMsg });
  // pass the error down (so other error handlers can also process the error)
  next(err);
};
