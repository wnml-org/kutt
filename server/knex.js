const knex = require("knex");
const env = require("./env");
const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");

const isSQLite = env.DB_CLIENT === "sqlite3" || env.DB_CLIENT === "better-sqlite3";
const isPostgres = env.DB_CLIENT === "pg" || env.DB_CLIENT === "pg-native";
const isMySQL = env.DB_CLIENT === "mysql" || env.DB_CLIENT === "mysql2";

function generateSessionName() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const environment = process.env.NODE_ENV || 'development';
  const instance = process.env.NODE_APP_INSTANCE || '0';
  
  // Create a unique session name that includes:
  // - Application name (kutt)
  // - Environment (prod/dev)
  // - Instance number (for multiple instances)
  // - Timestamp
  return `kutt-${environment}-${instance}-${timestamp}`;
}

async function getIAMToken() {
  if (!env.DB_USE_IAM) return null;
  
  const sts = new STSClient({ region: env.DB_IAM_REGION });
  const command = new AssumeRoleCommand({
    RoleArn: env.DB_IAM_ROLE_ARN,
    RoleSessionName: generateSessionName()
  });
  
  try {
    const response = await sts.send(command);
    return response;
  } catch (error) {
    console.error('Error getting IAM token:', error);
    throw error;
  }
}

const db = knex({
  client: env.DB_CLIENT,
  connection: async () => {
    const baseConfig = {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      ssl: env.DB_SSL,
      pool: {
        min: env.DB_POOL_MIN,
        max: env.DB_POOL_MAX
      }
    };

    if (env.DB_USE_IAM && isPostgres) {
      const iamToken = await getIAMToken();
      return {
        ...baseConfig,
        password: iamToken.Credentials.SecretAccessKey
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
