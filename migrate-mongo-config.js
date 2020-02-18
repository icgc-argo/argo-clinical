// In this file you can configure migrate-mongo

const config = {
  mongodb: {
    url: process.env.CLINICAL_DB_URL || 'mongodb://localhost:27027/clinical',
    databaseName: 'clinical',
    options: {
      auth: {
        user: process.env.CLINICAL_DB_USERNAME || 'admin',
        password: process.env.CLINICAL_DB_PASSWORD || 'password',
      },
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
    },
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: 'migrations',

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: 'changelog',
};

// Return the config as a promise
module.exports = config;
