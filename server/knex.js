const knex = require("knex");
const env = require("./env");
const { Signer } = require("@aws-sdk/rds-signer");
const { readFileSync } = require("fs");
const isSQLite = env.DB_CLIENT === "sqlite3" || env.DB_CLIENT === "better-sqlite3";
const isPostgres = env.DB_CLIENT === "pg" || env.DB_CLIENT === "pg-native";
const isMySQL = env.DB_CLIENT === "mysql" || env.DB_CLIENT === "mysql2";


async function getRDSAuthToken() {
  if (!env.DB_USE_IAM) return null;
  
  try {
    console.log('Generating RDS auth token with:', {
      region: env.DB_IAM_REGION,
      hostname: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER
    });

    const signer = new Signer({
      hostname: env.DB_HOST,
      port: env.DB_PORT,
      region: env.DB_IAM_REGION,
      username: env.DB_USER,
      formattedCredentials: true
    });

    const token = await signer.getAuthToken();
    console.log('Generated token length:', token?.length);
    console.log('Token prefix:', token?.substring(0, 50) + '...');
    return token
  } catch (error) {
    console.error('Error getting RDS auth token:', error);
    throw error;
  }
}

const db = knex({
  client: env.DB_CLIENT,
  connection: async () => {
    const baseConfig = {
      filename: env.DB_FILENAME,
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      ssl: env.DB_SSL ? {
        rejectUnauthorized: true,
        ca: env.DB_SSL_CA_PATH ? readFileSync(env.DB_SSL_CA_PATH, 'utf8') : undefined,
        sslmode: 'verify-full'
      } : undefined,
      pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX
      }
    };

    if (env.DB_USE_IAM && isPostgres) {
      const authToken = await getRDSAuthToken();
      return {
        ...baseConfig,
        password: authToken
      };
    }

    return {
      ...baseConfig,
      password: env.DB_PASSWORD
    };
  },
  useNullAsDefault: true,
});

db.isPostgres = isPostgres;
db.isSQLite = isSQLite;
db.isMySQL = isMySQL;

db.compatibleILIKE = isPostgres ? "andWhereILike" : "andWhereLike";

module.exports = db;
