import express, { NextFunction, Response, RequestHandler } from "express";
import errorHandler from "errorhandler";
import bodyParser from "body-parser";
import path from "path";
import submissionAPI from "./submission/submission-api";
import * as schemaApi from "./submission/schema-api";
import * as middleware from "./middleware";
import * as swaggerUi from "swagger-ui-express";
import yaml from "yamljs";
import multer from "multer";
import { loggerFor } from "./logger";
import clinicalApi from "./clinical/clinical-api";
import { getHealth, Status } from "./app-health";

const L = loggerFor(__filename);

const upload = multer({ dest: "/tmp" });

// Create Express server
const app = express();
process.title = "clinical";
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

app.set("port", process.env.PORT || 3000);

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "./resources/working.gif")));
app.get("/health", (req, res) => {
  const health = getHealth();
  const resBody = {
    version: `${process.env.CLINICAL_VERSION} - ${process.env.CLINICAL_COMMIT_ID}`,
    health: health
  };
  if (health.all.status == Status.OK) {
    return res.status(200).send(resBody);
  }
  return res.status(500).send(resBody);
});
app.get(
  "/submission/program/:programId/registration",
  middleware.wrapAsync(submissionAPI.getRegistrationByProgramId)
);
app.post(
  "/submission/program/:programId/registration",
  upload.single("registrationFile"),
  middleware.wrapAsync(submissionAPI.createRegistrationWithTsv)
);
app.post(
  "/submission/program/:programId/registration/:id/commit",
  middleware.wrapAsync(submissionAPI.commitRegistration)
);
app.delete(
  "/submission/program/:programId/registration/:id",
  middleware.wrapAsync(submissionAPI.deleteRegistration)
);
app.get(
  "/submission/program/:programId/clinical/upload",
  middleware.wrapAsync(submissionAPI.getActiveSubmissionByProgramId)
);
app.post(
  "/submission/program/:programId/clinical/upload",
  upload.array("clinicalFiles"),
  middleware.wrapAsync(submissionAPI.saveClinicalTsvFiles)
);
app.post(
  "/submission/program/:programId/clinical/validate/:versionId",
  middleware.wrapAsync(submissionAPI.validateActiveSubmission)
);
/** Schema API */
app.get("/submission/schema/", middleware.wrapAsync(schemaApi.get));
// get template for a given schema
app.get("/submission/schema/template/:schemaName", middleware.wrapAsync(schemaApi.getTemplate));
// temporary api
app.post("/submission/schema/hack/refresh", middleware.wrapAsync(schemaApi.update));
app.post("/submission/schema/hack/replace", middleware.wrapAsync(schemaApi.replace));

/** clinical API */
app.get("/clinical/donors", middleware.wrapAsync(clinicalApi.findDonors));
app.delete("/clinical/donors", middleware.wrapAsync(clinicalApi.deleteDonors));
app.get("/clinical/donors/id", middleware.wrapAsync(clinicalApi.findDonorId));
app.get("/clinical/specimens/id", middleware.wrapAsync(clinicalApi.findSpecimenId));
app.get("/clinical/samples/id", middleware.wrapAsync(clinicalApi.findSampleId));

// this has to be defined after all routes for it to work for these paths.
app.use(middleware.errorHandler);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(yaml.load(path.join(__dirname, "./resources/swagger.yaml")))
);

if (process.env.NODE_ENV !== "PRODUCTION") {
  app.use(errorHandler());
}

export default app;
