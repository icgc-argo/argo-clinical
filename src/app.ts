import express, { NextFunction, Request, Response, RequestHandler } from "express";
import errorHandler from "errorhandler";
import bodyParser from "body-parser";

import * as submissionAPI from "./submission/submission-api";
import * as schemaApi from "./lectern-client/schema-api";
import * as middleware from "./middleware";
import multer from "multer";
import mongoose from "mongoose";
import { loggerFor } from "./logger";
const L = loggerFor(__filename);

const upload = multer({ dest: "/tmp" });

// Create Express server
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.set("port", 3000);
app.get("/", (req, res) => res.sendFile(__dirname + "/resources/working.gif"));
app.get("/submission/registration", middleware.wrapAsync(submissionAPI.getRegistrationByProgramId));
app.post("/submission/registration", upload.single("registrationFile"), middleware.wrapAsync(submissionAPI.createRegistrationWithTsv));
app.patch("/submission/registration/:id", middleware.wrapAsync(submissionAPI.commitRegistration));

/** Schema API */
app.get("/submission/schema/", middleware.wrapAsync(schemaApi.getSchema));

// this has to be defined after all routes for it to work for these paths.
app.use(middleware.errorHandler);
if (process.env.NODE_ENV !== "PRODUCTION") {
    app.use(errorHandler());
}

app.use((req, res, next) => {
    // action after response
    const afterResponse = function() {
     L.info(`${req} End request`);
      // any other clean ups
      mongoose.connection.close(function () {
        L.info("Mongoose connection disconnected");
      });
    };
    // hooks to execute after response
    res.on("finish", afterResponse);
    res.on("close", afterResponse);
    next();
});

export default app;