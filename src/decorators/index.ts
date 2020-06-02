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

import { Request, Response, RequestHandler, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { loggerFor } from '../logger';
import { config } from '../config';
const L = loggerFor(__filename);

const getToken = (request: Request) => {
  if (!request.headers.authorization) {
    return undefined;
  }
  const token = decodeAndVerify(request.headers.authorization.split(' ')[1]);
  return token;
};

const decodeAndVerify = (tokenJwtString: string) => {
  const key = config.getConfig().jwtPubKey();
  if (key.trim() === '') {
    throw new Error('no key found to verify the token');
  }
  try {
    const decoded = jwt.verify(tokenJwtString, key);
    return decoded;
  } catch (err) {
    L.debug(`invalid token provided ${err}`);
    return undefined;
  }
};

const hasScope = (scopes: string[], token: any) => {
  if (
    !token.context ||
    !token.context.scope ||
    token.context.scope.filter((s: string) => scopes.indexOf(s) >= 0).length === 0
  ) {
    return false;
  }
  return true;
};

const checkAuthorization = (scopes: string[], request: Request, response: Response) => {
  const token = getToken(request);
  if (!token) {
    return response.status(401).send('This endpoint needs a valid authentication token');
  }
  if (!hasScope(scopes, token)) {
    return response.status(403).send("Caller doesn't have the required permissions");
  }
  return undefined;
};

const scopeCheckGenerator = (
  functionName: string,
  scopesGenerator: (programId: string) => string[],
  programIdExtractor?: Function,
) => {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as RequestHandler;
    descriptor.value = function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      const programId = programIdExtractor ? programIdExtractor(request) : '';
      programIdExtractor && L.debug(`${functionName} @ ${key} was called with: ${programId}`);
      const unauthorizedResponse = checkAuthorization(
        scopesGenerator(programId),
        request,
        response,
      );
      if (unauthorizedResponse !== undefined) {
        return unauthorizedResponse;
      }
      const result = originalMethod.apply(this, [request, response, next]);
      return result;
    };
    return descriptor;
  };
};

export const ProtectTestEndpoint = () => {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as RequestHandler;
    descriptor.value = function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      const testPointsDisabled = config.getConfig().testApisDisabled();

      if (testPointsDisabled) {
        return response.status(405).send('not allowed');
      }

      const result = originalMethod.apply(this, [request, response, next]);
      return result;
    };
    return descriptor;
  };
};

export function HasProgramWriteAccess(programIdExtractor: Function) {
  return scopeCheckGenerator(
    'HasProgramWriteAccess',
    programId => [`PROGRAMDATA-${programId}.WRITE`, 'CLINICALSERVICE.WRITE'],
    programIdExtractor,
  );
}

export function HasFullWriteAccess() {
  return scopeCheckGenerator('HasFullWriteAccess', () => ['CLINICALSERVICE.WRITE']);
}

export function HasFullReadAccess() {
  return scopeCheckGenerator('HasFullReadAccess', () => [
    'CLINICALSERVICE.READ',
    'CLINICALSERVICE.WRITE',
  ]);
}
