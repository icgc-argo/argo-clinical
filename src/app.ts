import express, { NextFunction, Request, Response, RequestHandler } from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import * as submissionAPI from "./infra/rest/submission";
import mongoose from "mongoose";
import * as middleware from "./middleware";
// Create Express server
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
app.set("port", 3000);

const connectToDb = async (delayMillis: number) => setTimeout(async () => {
    console.log("connecting to mongo");
    try {
        await mongoose.connect("mongodb://localhost:27017/clinical", {useNewUrlParser: true});
    } catch (err) {
        console.error("failed to connect to mongo", err);
        // retry in 5 sec
        connectToDb(5000);
    }
}, delayMillis);

// try connecting to db.
connectToDb(1000);

app.get("/", (req, res) => res.send("Hello World 2!"));

app.get("/submission/registration", middleware.wrapAsync(submissionAPI.getRegistrationByProgramId));
app.post("/submission/registration", middleware.wrapAsync(submissionAPI.createRegistration));
app.patch("/submission/registration/:id", middleware.wrapAsync(submissionAPI.commitRegistration));

app.use(middleware.errorHandler);
export default app;