// In this file you can configure migrate-mongo
let auth = undefined;
if (process.env.CLINICAL_DB_USERNAME && process.env.CLINICAL_DB_PASSWORD) {
  auth = {
    user: process.env.CLINICAL_DB_USERNAME,
    password: process.env.CLINICAL_DB_PASSWORD,
  };
}

const config = {
  mongodb: {
    url: process.env.CLINICAL_DB_URL,
    databaseName: 'clinical',
    options: {
      auth: auth,
      useNewUrlParser: true, // removes a deprecation warning when connecting
      useUnifiedTopology: true, // removes a deprecating warning when connecting
    },
  },

  // The migrations dir, can be an relative or absolute path. Only edit this when really necessary.
  migrationsDir: 'migrations',

  // The mongodb collection where the applied changes are stored. Only edit this when really necessary.
  changelogCollectionName: 'changelog',
};

// create secure version of config to log
const configCopy = JSON.parse(JSON.stringify(config)); // a hack to deep copy
if (configCopy.mongodb.options.auth) {
  console.log('hiding auth..');
  configCopy.mongodb.options.auth.user = configCopy.mongodb.options.auth.user.length;
  configCopy.mongodb.options.auth.password = configCopy.mongodb.options.auth.password.length;
}
console.log(JSON.stringify(configCopy));

// Return the config as a promise
module.exports = config;
