import express from "express";
import dotenv from "dotenv";

// Create Express server
const app = express();

app.set("port", 3000);

app.get("/", (req, res) => res.send("Hello World!"));

export default app;