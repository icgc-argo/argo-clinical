import { DonorModel } from "../../infra/db/model";
import { Donor, Sample, Specimen } from "../../domain/clinical/entities";

export interface DonorDAO {
    createDonor(donor: CreateDonorDto): Promise<Donor>;
}

export const donorDao: DonorDAO = {
    async createDonor(createDonorDto: CreateDonorDto): Promise<Donor> {
        const donor: Donor = {
            donorId: undefined,
            gender: createDonorDto.gender,
            submitterId: createDonorDto.submitterId,
            programId: createDonorDto.programId,
            specimens: createDonorDto.specimens.map(s => {
                const spec: Specimen = {
                    samples: s.samples.map(sa => {
                        const sample: Sample = {
                            sampleType: sa.sampleType,
                            submitterId: sa.submitterId,
                        };
                        return sample;
                    }),
                    clinicalInfo: undefined,
                    submitterId: s.submitterId
                };
                return spec;
            }),
            clinicalInfo: undefined,
            primaryDiagnosis: undefined,
            followUps: undefined,
            treatments: undefined,
            chemotherapy:  undefined,
            HormoneTherapy:  undefined,

        };
        const newDonor = new DonorModel(donor);
        await newDonor.save();
        return newDonor;
    }
};

export interface CreateDonorDto {
    gender: string;
    submitterId: string;
    programId: string;
    specimens: Array<CreateSpecimen>;
}

export interface CreateSpecimen {
    samples: Array<CreateSample>;
    submitterId: string;
}

export interface CreateSample {
    sampleType: string;
    submitterId: string;
}

