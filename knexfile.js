// this configuration is for migrations only
// and since jwt secret is not required, it's set to a placehodler string to bypass env validation
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "securekey";
}

const env = require("./server/env");
const { Signer } = require("@aws-sdk/rds-signer");
const { readFileSync } = require("fs");


const isSQLite = env.DB_CLIENT === "sqlite3" || env.DB_CLIENT === "better-sqlite3";


module.exports = (async () => {

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

  const config = {
    client: env.DB_CLIENT,
    connection: {
      ...(isSQLite && { filename: env.DB_FILENAME }),
      host: env.DB_HOST,
      database: env.DB_NAME,
      user: env.DB_USER,
      port: env.DB_PORT,
      password: env.DB_USE_IAM ? await getRDSAuthToken() : env.DB_PASSWORD,
      ssl: env.DB_USE_IAM ? {
        rejectUnauthorized: true,
        ca: env.DB_SSL_CA_PATH ? readFileSync(env.DB_SSL_CA_PATH, 'utf8') : undefined,
        sslmode: 'verify-full'
      } : env.DB_SSL,
    },
    useNullAsDefault: true,
    migrations: {
        tableName: "knex_migrations",
        directory: "server/migrations",
        disableMigrationsListValidation: true,
      }
    };

  return config;
})();
