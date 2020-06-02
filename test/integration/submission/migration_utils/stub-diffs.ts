/*
 * Copyright (c)  2020 The Ontario Institute for Cancer Research. All rights reserved
 *
 * This program and the accompanying materials are made available under the terms of
 * the GNU Affero General Public License v3.0. You should have received a copy of the
 * GNU Affero General Public License along with this program.
 *  If not, see <http://www.gnu.org/licenses/>.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 * INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED
 * TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
 * OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER
 * IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 * ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// computed separately using lectern's diff tool
import legacyStubSchemas from '../../stub-schema.json';

export const migrationDiffs = [
  legacyStubSchemas.diffs[0],
  {
    fromVersion: '1.0',
    toVersion: '4.0',

    data: [
      [
        'donor.cause_of_death',
        {
          left: {
            description: "Description of the cause of a donor's death.",
            name: 'cause_of_death',
            restrictions: {
              codeList: ['Died of cancer', 'Died of other reasons', 'Not reported', 'Unknown'],
            },
            valueType: 'string',
            meta: {
              core: true,
            },
          },
          right: {
            description: "Description of the cause of a donor's death.",
            name: 'cause_of_death',
            restrictions: {
              codeList: [
                'Died of cancer',
                'Died of other reasons',
                'Not reported',
                'Unknown',
                'Died from disease',
              ],
            },
            valueType: 'string',
            meta: {
              core: true,
            },
          },
          diff: {
            restrictions: {
              codeList: {
                type: 'updated',
                data: {
                  added: ['Died from disease'],
                  deleted: [],
                },
              },
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '5.0',

    data: [
      [
        'donor.height',
        {
          right: {
            description: 'How tall is the donor',
            name: 'height',
            restrictions: {
              required: false,
            },
            valueType: 'string',
          },
          diff: {
            type: 'created',
            data: {
              description: 'How tall is the donor',
              name: 'height',
              restrictions: {
                required: false,
              },
              valueType: 'string',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '6.0',

    data: [
      [
        'lifestyle_factors.diet',
        {
          right: {
            description: 'the diet they eat',
            name: 'diet',
            valueType: 'string',
          },
          diff: {
            type: 'created',
            data: {
              description: 'the diet they eat',
              name: 'diet',
              valueType: 'string',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '7.0',

    data: [
      [
        'primary_diagnosis.tumour_staging_system',
        {
          left: {
            name: 'tumour_staging_system',
            valueType: 'string',
            description:
              'Specify the tumour staging system used to stage the cancer at the time of primary diagnosis (prior to treatment).',
            restrictions: {
              required: true,
              codeList: ['Binet', 'Rai', 'FIGO', 'Ann Arbor', 'Murphy', 'Lugano'],
            },
          },
          right: {
            name: 'tumour_staging_system',
            valueType: 'string',
            description:
              'Specify the tumour staging system used to stage the cancer at the time of primary diagnosis (prior to treatment).',
            restrictions: {
              required: true,
              codeList: ['Binet', 'Rai', 'FIGO', 'Ann Arbor', 'Lugano'],
            },
          },
          diff: {
            restrictions: {
              codeList: {
                type: 'updated',
                data: {
                  added: [],
                  deleted: ['Murphy'],
                },
              },
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '8.0',

    data: [
      [
        'donor.eye_colour',
        {
          right: {
            description: 'colour of their eye',
            name: 'eye_colour',
            restrictions: {
              required: true,
            },
            valueType: 'string',
          },
          diff: {
            type: 'created',
            data: {
              description: 'colour of their eye',
              name: 'eye_colour',
              restrictions: {
                required: true,
              },
              valueType: 'string',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '9.0',

    data: [
      [
        'donor.cause_of_death',
        {
          left: {
            description: "Description of the cause of a donor's death.",
            name: 'cause_of_death',
            restrictions: {
              codeList: ['Died of cancer', 'Died of other reasons', 'Not reported', 'Unknown'],
            },
            valueType: 'string',
            meta: {
              core: true,
            },
          },
          diff: {
            type: 'deleted',
            data: {
              description: "Description of the cause of a donor's death.",
              name: 'cause_of_death',
              restrictions: {
                codeList: ['Died of cancer', 'Died of other reasons', 'Not reported', 'Unknown'],
              },
              valueType: 'string',
              meta: {
                core: true,
              },
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '10.0',

    data: [
      [
        'primary_diagnosis.age_at_diagnosis',
        {
          left: {
            name: 'age_at_diagnosis',
            valueType: 'integer',
            description: 'Age that the donor was first diagnosed with cancer, in years.',
            restrictions: {
              required: true,
            },
            meta: {
              units: 'years',
              core: true,
            },
          },
          right: {
            name: 'age_at_diagnosis',
            valueType: 'integer',
            description: 'Age that the donor was first diagnosed with cancer, in years.',
            restrictions: {
              required: true,
              script: [
                "(function validate() {\n    return { valid: false, message: 'not a valid age!' };\n  })()",
              ],
            },
            meta: {
              units: 'years',
              core: true,
            },
          },
          diff: {
            restrictions: {
              script: {
                type: 'created',
                data: [
                  "(function validate() {\n    return { valid: false, message: 'not a valid age!' };\n  })()",
                ],
              },
            },
          },
        },
      ],
      [
        'primary_diagnosis.cancer_type_code',
        {
          left: {
            name: 'cancer_type_code',
            valueType: 'string',
            description:
              'The code to represent the cancer type using the WHO ICD-10 code (https://icd.who.int/browse10/2016/en#/) classification.',
            restrictions: {
              required: true,
              regex: '[A-Z]{1}[0-9]{2}.[0-9]{0,3}[A-Z]{0,1}$',
            },
            meta: {
              core: true,
            },
          },
          right: {
            name: 'cancer_type_code',
            valueType: 'string',
            description:
              'The code to represent the cancer type using the WHO ICD-10 code (https://icd.who.int/browse10/2016/en#/) classification.',
            restrictions: {
              required: true,
              regex: '^aRegexToFail$',
            },
            meta: {
              core: true,
            },
          },
          diff: {
            restrictions: {
              regex: {
                type: 'updated',
                data: '^aRegexToFail$',
              },
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '11.0',

    data: [
      [
        'donor.survival_time',
        {
          left: {
            description:
              'Interval of how long the donor has survived since primary diagnosis, in days.',
            meta: {
              units: 'days',
              core: 'true',
            },
            name: 'survival_time',
            valueType: 'integer',
          },
          right: {
            description:
              'Interval of how long the donor has survived since primary diagnosis, in days.',
            meta: {
              units: 'days',
              core: 'true',
            },
            name: 'survival_time',
            valueType: 'string',
          },
          diff: {
            valueType: {
              type: 'updated',
              data: 'string',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '12.0',

    data: [
      [
        'donor.program_id',
        {
          left: {
            name: 'program_id',
            valueType: 'string',
            description: 'Unique identifier of the ARGO program.',
            restrictions: {
              required: true,
            },
          },
          right: {
            name: 'program_id',
            valueType: 'program_identification_code',
            description: 'Unique identifier of the ARGO program.',
            restrictions: {
              required: true,
            },
          },
          diff: {
            valueType: {
              type: 'updated',
              data: 'program_identification_code',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '12.0',

    data: [
      [
        'donor.program_id',
        {
          left: {
            name: 'program_id',
            valueType: 'string',
            description: 'Unique identifier of the ARGO program.',
            restrictions: {
              required: true,
            },
          },
          right: {
            name: 'program_id',
            valueType: 'program_identification_code',
            description: 'Unique identifier of the ARGO program.',
            restrictions: {
              required: true,
            },
          },
          diff: {
            valueType: {
              type: 'updated',
              data: 'program_identification_code',
            },
          },
        },
      ],
    ],
  },
  {
    fromVersion: '1.0',
    toVersion: '13.0',

    data: [
      [
        'hormone_therapy.program_id',
        {
          left: {
            name: 'program_id',
            valueType: 'string',
            description: 'Unique identifier of the ARGO program.',
            meta: {
              primaryId: true,
              foreignKey: 'sample_registration.program_id',
            },
            restrictions: {
              required: true,
              regex: '[A-Za-z0-9\\-\\._]{1,64}',
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'program_id',
              valueType: 'string',
              description: 'Unique identifier of the ARGO program.',
              meta: {
                primaryId: true,
                foreignKey: 'sample_registration.program_id',
              },
              restrictions: {
                required: true,
                regex: '[A-Za-z0-9\\-\\._]{1,64}',
              },
            },
          },
        },
      ],
      [
        'hormone_therapy.submitter_donor_id',
        {
          left: {
            name: 'submitter_donor_id',
            valueType: 'string',
            description: 'Unique identifier of the donor, assigned by the data provider.',
            meta: {
              primaryId: true,
              foreignKey: 'sample_registration.submitter_donor_id',
            },
            restrictions: {
              required: true,
              regex: '[A-Za-z0-9\\-\\._]{1,64}',
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'submitter_donor_id',
              valueType: 'string',
              description: 'Unique identifier of the donor, assigned by the data provider.',
              meta: {
                primaryId: true,
                foreignKey: 'sample_registration.submitter_donor_id',
              },
              restrictions: {
                required: true,
                regex: '[A-Za-z0-9\\-\\._]{1,64}',
              },
            },
          },
        },
      ],
      [
        'hormone_therapy.submitter_treatment_id',
        {
          left: {
            name: 'submitter_treatment_id',
            valueType: 'string',
            description: 'Unique identifier of the treatment, as assigned by the data provider.',
            meta: {
              primaryId: true,
              foreignKey: 'treatment.submitter_treatment_id',
            },
            restrictions: {
              required: true,
              regex: '[A-Za-z0-9\\-\\._]{1,64}',
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'submitter_treatment_id',
              valueType: 'string',
              description: 'Unique identifier of the treatment, as assigned by the data provider.',
              meta: {
                primaryId: true,
                foreignKey: 'treatment.submitter_treatment_id',
              },
              restrictions: {
                required: true,
                regex: '[A-Za-z0-9\\-\\._]{1,64}',
              },
            },
          },
        },
      ],
      [
        'hormone_therapy.drug_name',
        {
          left: {
            name: 'drug_name',
            description:
              'Name of agent or drug administered to patient as part of the hormone therapy treatment regimen.',
            valueType: 'string',
            restrictions: {
              required: true,
              codeList: ['Placeholder list 1', 'Need list', 'Still need it', 'Other'],
            },
            meta: {
              core: true,
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'drug_name',
              description:
                'Name of agent or drug administered to patient as part of the hormone therapy treatment regimen.',
              valueType: 'string',
              restrictions: {
                required: true,
                codeList: ['Placeholder list 1', 'Need list', 'Still need it', 'Other'],
              },
              meta: {
                core: true,
              },
            },
          },
        },
      ],
      [
        'hormone_therapy.hormone_drug_dosage_units',
        {
          left: {
            name: 'hormone_drug_dosage_units',
            description: 'Indicate the units used to record hormone drug dosage.',
            valueType: 'string',
            restrictions: {
              required: true,
              codeList: ['mg/m²', 'IU/m²', 'µg/m²', 'g/m²', 'kg '],
            },
            meta: {
              core: true,
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'hormone_drug_dosage_units',
              description: 'Indicate the units used to record hormone drug dosage.',
              valueType: 'string',
              restrictions: {
                required: true,
                codeList: ['mg/m²', 'IU/m²', 'µg/m²', 'g/m²', 'kg '],
              },
              meta: {
                core: true,
              },
            },
          },
        },
      ],
      [
        'hormone_therapy.cumulative_drug_dosage',
        {
          left: {
            name: 'cumulative_drug_dosage',
            description:
              'Indicate total drug dose in units specified in hormone_drug_dosage_units.',
            valueType: 'integer',
            restrictions: {
              required: true,
            },
            meta: {
              core: true,
            },
          },
          diff: {
            type: 'deleted',
            data: {
              name: 'cumulative_drug_dosage',
              description:
                'Indicate total drug dose in units specified in hormone_drug_dosage_units.',
              valueType: 'integer',
              restrictions: {
                required: true,
              },
              meta: {
                core: true,
              },
            },
          },
        },
      ],
    ],
  },
];
