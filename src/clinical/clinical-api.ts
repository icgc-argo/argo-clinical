import { Request, Response } from "express";
import * as service from "./clinical-service";

export const findDonors = async (req: Request, res: Response) => {
  return res.status(200).send(await service.getDonors(req.query.programId));
};

export const deleteDonors = async (req: Request, res: Response) => {
  return res.status(200).send(await service.deleteDonors(req.query.programId));
};
