// Has to import config before any other import uses the configurations
import { AppConfig } from "./config";
import * as bootstrap from "./bootstrap";
import app from "./app";

const defaultAppConfigImpl: AppConfig = {
  mongoUrl(): string {
    return process.env.CLINICAL_DB_URL || "";
  },
  initialSchemaVersion(): string {
    return process.env.INITIAL_SCHEMA_VERSION || "";
  },
  schemaName(): string {
    return process.env.SCHEMA_NAME || "";
  },
  jwtPubKeyUrl(): string {
    return process.env.JWT_TOKEN_PUBLIC_KEY_URL || "";
  },
  jwtPubKey(): string {
    return process.env.JWT_TOKEN_PUBLIC_KEY || "";
  },
  schemaServiceUrl(): string {
    return process.env.LECTERN_URL || "";
  }
};

bootstrap.run(defaultAppConfigImpl);
/**
 * Start Express server.
 */
const server = app.listen(app.get("port"), () => {
  console.log(" App is running at http://localhost:%d in %s mode", app.get("port"), app.get("env"));
  console.log("  Press CTRL-C to stop\n");
});

export default server;
