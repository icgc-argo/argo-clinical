import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import * as submissionAPI from "./infra/apis/submission/submission";
import mongoose from "mongoose";

// Create Express server
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

app.set("port", 3000);

mongoose.connect("mongodb://localhost:27017/clinical", {useNewUrlParser: true});

app.get("/", (req, res) => res.send("Hello World 2!"));

app.post("/submission/", async (req, res) => {
    return await submissionAPI.createRegistration(req, res);
});

export default app;