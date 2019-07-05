import * as bootstrap from "./bootstrap";
import app from "./app";

/**
 * Start Express server.
 */
bootstrap.run();
const server = app.listen(app.get("port"), () => {
  console.log(
    " App is running at http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  console.log("  Press CTRL-C to stop\n");
});

export default server;