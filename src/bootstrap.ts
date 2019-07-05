import mongoose from "mongoose";

const setupDB = () => {
    // mongoose.Promise = Promise;
    mongoose.connection.on("connected", () => {
        console.log("Connection Established");
    });

    mongoose.connection.on("reconnected", () => {
        console.log("Connection Reestablished");
    });

    mongoose.connection.on("disconnected", () => {
        console.log("Connection Disconnected");
    });

    mongoose.connection.on("close", () => {
        console.log("Connection Closed");
    });

    mongoose.connection.on("error", (error) => {
        console.log("ERROR: " + error);
    });

    const connectToDb = async (delayMillis: number) => setTimeout(async () => {
            console.log("connecting to mongo");
            try {
                await mongoose.connect("mongodb://localhost:27017/clinical", {
                    autoReconnect: true,
                    socketTimeoutMS: 0,
                    keepAlive: true,
                    reconnectTries: 1000,
                    reconnectInterval: 3000,
                    bufferMaxEntries: 0, // Disable node driver's buffering as well
                    useNewUrlParser: true
                });
            } catch (err) {
                console.error("failed to connect to mongo", err);
                // retry in 5 secs
                connectToDb(5000);
            }
        }, delayMillis);

    connectToDb(1000);
};

export const run = () => {
    setupDB();
};