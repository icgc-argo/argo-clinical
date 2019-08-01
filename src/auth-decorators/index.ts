import { Request, Response, RequestHandler, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { loggerFor } from "../logger";
import util from "util";
const pjwtVerify = util.promisify(jwt.verify);
import fetch from "node-fetch";

const L = loggerFor(__filename);

const getToken = async (request: Request) => {
  if (!request.headers.authorization) {
    return undefined;
  }
  const token: any = await decodeAndVerify(request.headers.authorization.split(" ")[1]);
  return token;
};

const decodeAndVerify = async (tokenJwtString: string) => {
  const url = process.env.JWT_TOKEN_PUBLIC_KEY_URL || "";
  const response = await fetch(url);
  const buffer = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhk...\n-----END PUBLIC KEY-----"; // await response.text();
  const decoded: any = jwt.verify(tokenJwtString, buffer, {
    algorithms: ["RS256"]
  });
  return decoded;
};

const hasScope = (scopes: string[], token: any) => {
  if (!token.scope || !token.scope.filter((s: string) => scopes.indexOf(s))) {
    return false;
  }
  return true;
};

const checkAuthorization = async (scopes: string[], request: Request, response: Response) => {
  const token = await getToken(request);
  if (!token) {
    return response.status(401).send("this endpoint needs authentication");
  }
  if (!hasScope(scopes, token)) {
    return response.status(403).send("Caller doesn't have the required permissions");
  }
  return undefined;
};

export function HasSubmitionAccess(programIdExtractor: Function) {
  return function(target: any, key: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value as RequestHandler;
    descriptor.value = async function() {
      const request = arguments[0] as Request;
      const response = arguments[1] as Response;
      const next = arguments[2] as NextFunction;
      const programId = programIdExtractor(request);
      L.debug(`HasSubmitionAccess @ ${key} was called with: ${programId}`);
      const unauthorizedResponse = await checkAuthorization(
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
