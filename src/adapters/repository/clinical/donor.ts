import { DonorModel } from "../../../infra/mongoose/clinical/donor";
import { Donor, Sample, Specimen } from "../../../domain/entities/clinical";

export interface DonorRepository {
    register(donor: RegisterDonorDto): Promise<Donor>;
}

// Mongoose implementation of the DonorRepository
export const donorDao: DonorRepository = {
    async register(createDonorDto: RegisterDonorDto): Promise<Donor> {
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

export interface RegisterDonorDto {
    gender: string;
    submitterId: string;
    programId: string;
    specimens: Array<RegisterSpecimenDto>;
}

export interface RegisterSpecimenDto {
    samples: Array<RegisterSampleDto>;
    submitterId: string;
}

export interface RegisterSampleDto {
    sampleType: string;
    submitterId: string;
}

