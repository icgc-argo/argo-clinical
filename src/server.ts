import dotenv from "dotenv";
import app from "./app";
import * as bootstrap from "./bootstrap";

/**
 * Start Express server.
 */
dotenv.config();
bootstrap.run();

const server = app.listen(app.get("port"), () => {
  console.log(" App is running at http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  console.log("  Press CTRL-C to stop\n");
});

export default server;