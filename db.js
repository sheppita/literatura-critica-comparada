const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Configure a variável DATABASE_URL no Render para conectar ao Neon."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on("error", () => {
  console.error("Erro na conexão com o banco de dados.");
});

module.exports = pool;
