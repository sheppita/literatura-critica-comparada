const fs = require("node:fs");
const path = require("node:path");

const pool = require("./db");
const eixos = require("./eixos");

async function inicializarBanco() {
  const cliente = await pool.connect();

  try {
    await cliente.query("BEGIN");

    // Evita duas inicializações simultâneas.
    await cliente.query(
      "SELECT pg_advisory_xact_lock(847291)"
    );

    const estrutura = fs.readFileSync(
      path.join(__dirname, "schema.sql"),
      "utf8"
    );

    await cliente.query(estrutura);

    const verificacao = await cliente.query(
      "SELECT valor FROM configuracoes WHERE chave = $1",
      ["modulos_iniciais_v1"]
    );

    // Cadastra a lista original somente uma vez.
    if (verificacao.rows.length === 0) {
      for (const eixo of eixos) {
        for (const [indice, titulo] of eixo.modulos.entries()) {
          await cliente.query(
            `INSERT INTO modulos (eixo_id, titulo, ordem)
             VALUES ($1, $2, $3)`,
            [eixo.id, titulo, indice + 1]
          );
        }
      }

      await cliente.query(
        `INSERT INTO configuracoes (chave, valor)
         VALUES ($1, $2)`,
        ["modulos_iniciais_v1", "concluido"]
      );
    }

    await cliente.query("COMMIT");
  } catch (erro) {
    try {
      await cliente.query("ROLLBACK");
    } catch {
      // A conexão pode já estar indisponível.
    }

    throw erro;
  } finally {
    cliente.release();
  }
}

module.exports = inicializarBanco;
