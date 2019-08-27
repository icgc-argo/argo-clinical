import { Request, Response, RequestHandler, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { loggerFor } from "../logger";
import { config } from "../config";
const L = loggerFor(__filename);

const getToken = (request: Request) => {
  if (!request.headers.authorization) {
    return undefined;
  }
  const token = decodeAndVerify(request.headers.authorization.split(" ")[1]);
  return token;
};

const decodeAndVerify = (tokenJwtString: string) => {
  const key = config.getConfig().jwtPubKey();
  if (key.trim() === "") {
    throw new Error("no key found to verify the token");
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
  if (!token.scope || token.scope.filter((s: string) => scopes.indexOf(s) >= 0).length === 0) {
    return false;
  }
  return true;
};

const checkAuthorization = (scopes: string[], request: Request, response: Response) => {
  const token = getToken(request);
  if (!token) {
    return response.status(401).send("this endpoint needs a valid authentication token");
  }
  if (!hasScope(scopes, token)) {
    return response.status(403).send("Caller doesn't have the required permissions");
  }
  return undefined;
};

export function HasSubmitionAccess(programIdExtractor: Function) {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as RequestHandler;
    descriptor.value = function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      const programId = programIdExtractor(request);
      L.debug(`HasSubmitionAccess @ ${key} was called with: ${programId}`);
      const unauthorizedResponse = checkAuthorization(
        [`PROGRAMDATA-${programId}.WRITE`, "CLINICALSERVICE.WRITE"],
        request,
        response
      );
      if (unauthorizedResponse !== undefined) {
        return unauthorizedResponse;
      }
      const result = originalMethod.apply(this, [request, response, next]);
      return result;
    };
    return descriptor;
  };
}

export function HasFullReadAccess() {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as RequestHandler;
    descriptor.value = function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      L.debug(`HasFullReadAccess @ ${key} was called`);
      const unauthorizedResponse = checkAuthorization(
        ["CLINICALSERVICE.READ", "CLINICALSERVICE.WRITE"],
        request,
        response
      );
      if (unauthorizedResponse !== undefined) {
        return unauthorizedResponse;
      }
      const result = originalMethod.apply(this, [request, response, next]);
      return result;
    };
    return descriptor;
  };
}
