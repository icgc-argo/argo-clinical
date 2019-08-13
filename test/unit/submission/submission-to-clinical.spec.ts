import chai from "chai";
import * as sinon from "sinon";
import * as s2c from "../../../src/submission/submission-to-clinical";

import { registrationRepository } from "../../../src/submission/registration-repo";
import {
  donorDao,
  FindByProgramAndSubmitterFilter,
  CreateDonorDto
} from "../../../src/clinical/donor-repo";
import { ActiveRegistration } from "../../../src/submission/submission-entities";
import { Donor } from "../../../src/clinical/clinical-entities";

const id1 = "04042314bacas";
const id2 = "lafdksaf92149123";
const reg1: ActiveRegistration = {
  _id: id1,
  creator: "test",
  programId: "ABCD-EF",
  stats: {
    alreadyRegistered: {},
    newDonorIds: {
      abcd123: [0]
    },
    newSpecimenIds: {
      ss123: [0]
    },
    newSampleIds: {
      sm123: [0]
    }
  },
  records: [
    {
      program_id: "ABCD-EF",
      donor_submitter_id: "abcd123",
      gender: "Male",
      specimen_submitter_id: "ss123",
      specimen_type: "FFPE",
      tumour_normal_designation: "Normal",
      sample_submitter_id: "sm123",
      sample_type: "ctDNA"
    }
  ]
};

const reg2: ActiveRegistration = {
  _id: id2,
  creator: "test",
  programId: "ABCD-EF",
  stats: {
    alreadyRegistered: {},
    newDonorIds: {},
    newSpecimenIds: {
      ss123: [0]
    },
    newSampleIds: {
      sm123: [0]
    }
  },
  records: [
    {
      program_id: "ABCD-EF",
      donor_submitter_id: "abcd123",
      gender: "Male",
      specimen_submitter_id: "ss123",
      specimen_type: "FFPE",
      tumour_normal_designation: "Normal",
      sample_submitter_id: "sm123",
      sample_type: "ctDNA"
    }
  ]
};

describe("submission-to-clinical", () => {
  console.log("mocha is here");

  describe("commit registration", () => {
    let registrationRepoFindByIdStub: sinon.SinonStub;
    let findByProgramAndSubmitterIdStub: sinon.SinonStub;
    let deleteRegStub: sinon.SinonStub;
    let createDonorStub: sinon.SinonStub;
    let updateDonorStub: sinon.SinonStub;
    const sandBox = sinon.createSandbox();

    beforeEach(done => {
      // it's important to define stubs in scope otherwise mocha will excute them globally.
      registrationRepoFindByIdStub = sandBox.stub(registrationRepository, "findById");
      findByProgramAndSubmitterIdStub = sandBox.stub(donorDao, "findByProgramAndSubmitterId");
      deleteRegStub = sandBox.stub(registrationRepository, "delete");
      createDonorStub = sandBox.stub(donorDao, "create");
      updateDonorStub = sandBox.stub(donorDao, "update");
      done();
    });

    afterEach(done => {
      sandBox.restore();
      done();
    });

    it("should create donor if not existing", async () => {
      const filter: FindByProgramAndSubmitterFilter = {
        submitterId: "abcd123",
        programId: "ABCD-EF"
      };

      const expectedDonorDto: CreateDonorDto = {
        gender: "Male",
        programId: "ABCD-EF",
        specimens: [
          {
            samples: [
              {
                sampleType: "ctDNA",
                submitterId: "sm123"
              }
            ],
            specimenType: "FFPE",
            submitterId: "ss123",
            tumourNormalDesignation: "Normal"
          }
        ],
        submitterId: "abcd123"
      };
      registrationRepoFindByIdStub.withArgs(id1).returns(Promise.resolve(reg1));
      findByProgramAndSubmitterIdStub.withArgs(sinon.match([filter])).returns(Promise.resolve([]));
      const result = await s2c.commitRegisteration({
        programId: reg1.programId,
        registrationId: reg1._id as string
      });
      chai.expect(createDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
      chai.expect(deleteRegStub.calledOnceWithExactly(id1)).to.eq(true);
    });

    it("should update donor if existing", async () => {
      const filter: FindByProgramAndSubmitterFilter = {
        submitterId: "abcd123",
        programId: "ABCD-EF"
      };

      const existingDonor: Donor = {
        _id: "lkjsdal214",
        donorId: "DO3023",
        gender: "Male",
        programId: "ABCD-EF",
        submitterId: "abcd123",
        specimens: [
          {
            specimenId: "SP320",
            specimenType: "FFPE",
            submitterId: "ss330",
            tumourNormalDesignation: "Normal",
            samples: [
              {
                sampleId: "SA39",
                sampleType: "RNA",
                submitterId: "sr342"
              }
            ]
          }
        ]
      };

      const expectedDonorDto: Donor = {
        _id: "lkjsdal214",
        donorId: "DO3023",
        gender: "Male",
        programId: "ABCD-EF",
        specimens: [
          {
            specimenId: "SP320",
            specimenType: "FFPE",
            submitterId: "ss330",
            tumourNormalDesignation: "Normal",
            samples: [
              {
                sampleId: "SA39",
                sampleType: "RNA",
                submitterId: "sr342"
              }
            ]
          },
          {
            samples: [
              {
                sampleType: "ctDNA",
                submitterId: "sm123"
              }
            ],
            specimenType: "FFPE",
            submitterId: "ss123",
            tumourNormalDesignation: "Normal"
          }
        ],
        submitterId: "abcd123"
      };

      registrationRepoFindByIdStub.withArgs(id2).returns(Promise.resolve(reg2));
      findByProgramAndSubmitterIdStub
        .withArgs(sinon.match([filter]))
        .returns(Promise.resolve([existingDonor]));
      const result = await s2c.commitRegisteration({
        programId: reg2.programId,
        registrationId: reg2._id as string
      });
      chai.expect(updateDonorStub.calledOnceWith(sinon.match(expectedDonorDto))).to.eq(true);
      chai.expect(deleteRegStub.calledOnceWithExactly(id2)).to.eq(true);
    });
  });
});
