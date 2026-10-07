const pool = require("./db");
const eixos = require("./eixos");

async function carregarEmenta() {
  const cliente = await pool.connect();

  try {
    await cliente.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"
    );

    const resultadoModulos = await cliente.query(
      "SELECT * FROM modulos ORDER BY ordem, id"
    );

    const resultadoSubmodulos = await cliente.query(
      "SELECT * FROM submodulos ORDER BY ordem, id"
    );

    const resultadoTemas = await cliente.query(
      "SELECT * FROM temas ORDER BY ordem, id"
    );

    const temasPorSubmodulo = new Map();

    for (const tema of resultadoTemas.rows) {
      if (!temasPorSubmodulo.has(tema.submodulo_id)) {
        temasPorSubmodulo.set(tema.submodulo_id, []);
      }

      temasPorSubmodulo.get(tema.submodulo_id).push(tema);
    }

    const submodulosPorModulo = new Map();

    for (const submodulo of resultadoSubmodulos.rows) {
      if (!submodulosPorModulo.has(submodulo.modulo_id)) {
        submodulosPorModulo.set(submodulo.modulo_id, []);
      }

      submodulosPorModulo.get(submodulo.modulo_id).push({
        ...submodulo,
        temas: temasPorSubmodulo.get(submodulo.id) || []
      });
    }

    const ementa = eixos.map((eixo) => ({
      id: eixo.id,
      titulo: eixo.titulo,
      modulos: resultadoModulos.rows
        .filter((modulo) => modulo.eixo_id === eixo.id)
        .map((modulo) => ({
          ...modulo,
          submodulos: submodulosPorModulo.get(modulo.id) || []
        }))
    }));

    await cliente.query("COMMIT");

    return ementa;
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

module.exports = carregarEmenta;
