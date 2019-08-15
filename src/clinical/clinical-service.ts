import { donorDao } from "./donor-repo";

export async function getDonors(programId: string) {
  return await donorDao.findByProgramId(programId);
}

export async function deleteDonors(programId: string) {
  return await donorDao.deleteByProgramId(programId);
}
