import express, { NextFunction, Request, Response, RequestHandler } from "express";
import multer from "multer";

export const upload = multer({ dest: "/tmp" });

export const wrapAsync = (fn: RequestHandler): RequestHandler => {
    return (req, res, next) => {
        const routePromise = fn(req, res, next);
        if (routePromise.catch) {
            routePromise.catch(next);
        }
    };
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): any => {
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).send({ error: err.name, message: err.message });
    // pass the error down (so other error handlers can also process the error)
    next(err);
};