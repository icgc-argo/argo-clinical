import express, { NextFunction, Request, Response, RequestHandler } from "express";
import errorHandler from "errorhandler";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import * as submissionAPI from "./infra/controllers/submission";

import * as middleware from "./middleware";
import multer from "multer";

const upload = multer({ dest: "/tmp" });

// Create Express server
const app = express();



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.set("port", 3000);
app.get("/", (req, res) => res.send("Hello World 2!"));
app.get("/submission/registration", middleware.wrapAsync(submissionAPI.getRegistrationByProgramId));
app.post("/submission/registration", upload.single("registrationFile"), middleware.wrapAsync(submissionAPI.createRegistration));
app.patch("/submission/registration/:id", middleware.wrapAsync(submissionAPI.commitRegistration));

// this has to be defined after all routes for it to work for these paths.
app.use(middleware.errorHandler);
if (!process.env.PRODUCTION) {
    app.use(errorHandler());
 }
export default app;