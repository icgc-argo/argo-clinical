import express, { NextFunction, Request, Response, RequestHandler } from "express";
import multer from "multer";
import { loggerFor } from "./logger";
const L = loggerFor(__filename);
// multer file upload handler
export const upload = multer({ dest: "/tmp" });

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
    L.error("error handler received error: ", err);
    if (res.headersSent) {
        L.debug("error handler skipped");
        return next(err);
    }
    res.status(500).send({ error: err.name, message: err.message });
    // pass the error down (so other error handlers can also process the error)
    next(err);
};