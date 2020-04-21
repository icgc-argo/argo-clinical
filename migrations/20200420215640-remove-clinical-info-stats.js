export async function up(db) {
  await db.collection('donors').updateMany(
    {},
    {
      $unset: {
        clinicalInfoStats: '',
        aggregatedInfoStats: '',
        'primaryDiagnosis.clinicalInfoStats': '',
        'specimens.$[].clinicalInfoStats': '',
        'followUps.$[].clinicalInfoStats': '',
        'treatments.$[].clinicalInfoStats': '',
        'treatments.$[].therapies.$[].clinicalInfoStats': '',
      },
    },
    { multi: true },
  );
}

export async function down(db) {}
