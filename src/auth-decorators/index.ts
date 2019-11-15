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
