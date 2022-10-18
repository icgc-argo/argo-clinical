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

import { Request, Response, RequestHandler, NextFunction } from 'express';
import _ from 'lodash';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { loggerFor } from '../logger';
import { config } from '../config';
const L = loggerFor(__filename);

type TokenValidationResult = { success: boolean; data?: TokenData };
type TokenData = {
  scopes: string[];
};
type JwtPayload = { context: { scopes: [] } };

const getToken = async (request: Request): Promise<TokenValidationResult> => {
  if (!request.headers.authorization?.startsWith('Bearer ')) {
    L.debug(`invalid token provided`);
    return { success: false };
  }

  const authToken = request.headers.authorization.slice(7).trim(); // remove 'Bearer ' from header
  const isJwt = Boolean(jwt.decode(authToken));
  const tokenResult = isJwt ? verifyJwt(authToken) : await verifyEgoApiKey(authToken);

  return tokenResult;
};

const verifyJwt = (tokenJwtString: string): TokenValidationResult => {
  const key = config.getConfig().jwtPubKey();
  if (key.trim() === '') {
    const err = 'no key found to verify the token';
    L.debug(err);
    return { success: false };
  }
  try {
    const decoded = jwt.verify(`${tokenJwtString}`, key);
    const scopes = _.isObjectLike(decoded) && (<JwtPayload>decoded).context?.scopes;
    return _.isArray(scopes) ? { success: true, data: { scopes } } : { success: false };
  } catch (err) {
    L.debug(`invalid token provided ${err}`);
    return { success: false };
  }
};

const verifyEgoApiKey = async (keyString: string): Promise<TokenValidationResult> => {
  const EGO_URL = config.getConfig().egoUrl();
  const EGO_CLIENT_ID = config.getConfig().egoClientId();
  const EGO_CLIENT_SECRET = config.getConfig().egoClientSecret();
  const auth = 'Basic ' + Buffer.from(EGO_CLIENT_ID + ':' + EGO_CLIENT_SECRET).toString('base64');

  return await fetch(`${EGO_URL}/o/check_api_key?apiKey=${keyString}`, {
    method: 'post',
    headers: { 'Content-Type': 'application/json', authorization: auth },
  })
    .then(async res => {
      const token = await res.json();
      const { scopes } = token;
      if (token.error || !Boolean(scopes)) throw token.error || 'No token scopes provided';
      return { success: true, data: { scopes } };
    })
    .catch(err => {
      L.debug(`Error response: ${err}`);
      return { success: false };
    });
};

/**
 * Confirms if the at least one of the required scopes has been provided
 * @param requiredScopes at least one of these scopes must be provided
 * @param providedScopes scopes provided in auth header
 * @returns {boolean} true if provided scopes contains at least one of the requiredScopes
 */
const hasScope = (requiredScopes: string[], providedScopes: string[]): boolean =>
  requiredScopes.some(scope => providedScopes.includes(scope));

const checkAuthorization = async (scopes: string[], request: Request, response: Response) => {
  const { success, data } = await getToken(request);
  if (!success || !data) {
    return response.status(401).send('This endpoint needs a valid authentication token');
  }

  const { scopes: tokenScopes } = data;
  if (!hasScope(scopes, tokenScopes)) {
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
    descriptor.value = async function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      const programId = programIdExtractor ? programIdExtractor(request) : '';
      programIdExtractor && L.debug(`${functionName} @ ${key} was called with: ${programId}`);
      const unauthorizedResponse = await checkAuthorization(
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

export function HasProgramReadAccess(programIdExtractor: Function) {
  return scopeCheckGenerator(
    'HasProgramReadAccess',
    programId => [
      `PROGRAMDATA-${programId}.WRITE`,
      `PROGRAMDATA-${programId}.READ`,
      'CLINICALSERVICE.READ',
      'CLINICALSERVICE.WRITE',
    ],
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
