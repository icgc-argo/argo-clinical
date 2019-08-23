import { SUBMISSION_STATE, ActiveSubmission } from "../workspace/workspace-entites";
import { workspaceRepository } from "../workspace/workspace-repo";
import _ from "lodash";
import { SaveClinicalCommand2 } from "./submission-entities";

export const saveUnvalidatedSubmission = async (command: SaveClinicalCommand2) => {
  // create program if not exist
  let activeSubmission = await workspaceRepository.findByProgramId(command.programId);
  if (!activeSubmission) {
    activeSubmission = await workspaceRepository.create({
      programId: command.programId,
      state: SUBMISSION_STATE.OPEN,
      hashVersion: "42",
      clinicalEntities: []
    });
  }
  // insert into database
  const mergedSubmission = _.cloneDeep(activeSubmission) as ActiveSubmission;
  mergedSubmission.clinicalEntities = command.clinicalEntities;
  return await workspaceRepository.update(mergedSubmission);
};
