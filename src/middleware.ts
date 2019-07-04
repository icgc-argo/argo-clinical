import express, { NextFunction, Request, Response, RequestHandler } from "express";

export const wrapAsync = (fn: RequestHandler): RequestHandler => {
    return (req, res, next) => {
        const routePromise = fn(req, res, next);
        if (routePromise.catch) {
            routePromise.catch( (err: Error) => next(err));
        }
    };
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): any => {
    if (res.headersSent) {
        return next(err);
    }
    switch (err.name) {
        case "Conflict":
            res.status(409);
            break;
        case "BadRequest":
            res.status(400);
            break;
        default:
            res.status(500);
            break;
    }
    res.send({ error: err.name, message: err.message });
};