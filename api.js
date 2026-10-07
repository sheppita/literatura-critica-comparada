const express = require("express");
const pool = require("./db");
const carregarEmenta = require("./dados");
const eixos = require("./eixos");

const {
  exigirLogin,
  verificarCsrf
} = require("./seguranca");

const router = express.Router();

router.use(exigirLogin);

router.get("/backup", async (req, res, next) => {
  try {
    const ementa = await carregarEmenta();

    res.set(
      "Content-Disposition",
      'attachment; filename="backup-ementa.json"'
    );

    res.json({
      versao: 1,
      exportado_em: new Date().toISOString(),
      eixos: ementa
    });
  } catch (erro) {
    next(erro);
  }
});

router.use(verificarCsrf);

const tipos = [
  {
    rota: "modulos",
    tabela: "modulos",
    pai: "eixo_id",
    campos: ["titulo", "descricao", "ordem"]
  },
  {
    rota: "submodulos",
    tabela: "submodulos",
    pai: "modulo_id",
    campos: ["titulo", "descricao", "ordem"]
  },
  {
    rota: "temas",
    tabela: "temas",
    pai: "submodulo_id",
    campos: [
      "titulo",
      "descricao",
      "bibliografia",
      "links",
      "anotacoes",
      "status",
      "ordem"
    ]
  }
];

function validarId(valor) {
  const texto = String(valor ?? "");

  if (!/^[1-9]\d*$/.test(texto)) {
    throw new Error("Identificador inválido.");
  }

  const numero = Number(texto);

  if (!Number.isSafeInteger(numero) || numero > 2147483647) {
    throw new Error("Identificador inválido.");
  }

  return numero;
}

function prepararDados(tipo, corpo, novo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
    throw new Error("Dados inválidos.");
  }

  if (
    typeof corpo.titulo !== "string" ||
    !corpo.titulo.trim() ||
    corpo.titulo.trim().length > 500
  ) {
    throw new Error("Preencha um título com até 500 caracteres.");
  }

  const dados = { titulo: corpo.titulo.trim() };

  for (const campo of tipo.campos) {
    if (["titulo", "ordem", "status"].includes(campo)) {
      continue;
    }

    const valor = corpo[campo] ?? "";
    const limite = campo === "links" ? 20000 : 50000;

    if (typeof valor !== "string" || valor.length > limite) {
      throw new Error(`O campo ${campo} excede o tamanho permitido.`);
    }

    dados[campo] = valor;
  }

  const ordem = corpo.ordem ?? 0;

  if (
    (typeof ordem !== "number" && typeof ordem !== "string") ||
    String(ordem).trim() === ""
  ) {
    throw new Error("Informe uma ordem válida.");
  }

  dados.ordem = Number(ordem);

  if (
    !Number.isInteger(dados.ordem) ||
    dados.ordem < 0 ||
    dados.ordem > 1000000
  ) {
    throw new Error("A ordem deve ser um número entre 0 e 1000000.");
  }

  if (tipo.rota === "temas") {
    const status = corpo.status ?? "nao_iniciado";

    if (!["nao_iniciado", "em_estudo", "concluido"].includes(status)) {
      throw new Error("Status de estudo inválido.");
    }

    dados.status = status;
  }

  if (novo) {
    if (tipo.pai === "eixo_id") {
      if (!eixos.some((eixo) => eixo.id === corpo.eixo_id)) {
        throw new Error("Escolha um eixo válido.");
      }

      dados.eixo_id = corpo.eixo_id;
    } else {
      dados[tipo.pai] = validarId(corpo[tipo.pai]);
    }
  }

  return dados;
}

function responderErroBanco(erro, res, next) {
  if (erro.code === "23503") {
    return res.status(409).json({
      erro: "O módulo ou submódulo não existe mais. Atualize a página."
    });
  }

  next(erro);
}

for (const tipo of tipos) {
  router.post(`/${tipo.rota}`, async (req, res, next) => {
    let dados;

    try {
      dados = prepararDados(tipo, req.body, true);
    } catch (erro) {
      return res.status(400).json({ erro: erro.message });
    }

    try {
      const campos = Object.keys(dados);
      const valores = Object.values(dados);
      const marcadores = campos.map((campo, indice) => `$${indice + 1}`);

      const resultado = await pool.query(
        `INSERT INTO ${tipo.tabela} (${campos.join(", ")})
         VALUES (${marcadores.join(", ")})
         RETURNING *`,
        valores
      );

      res.status(201).json({ item: resultado.rows[0] });
    } catch (erro) {
      responderErroBanco(erro, res, next);
    }
  });

  router.put(`/${tipo.rota}/:id`, async (req, res, next) => {
    let id;
    let dados;

    try {
      id = validarId(req.params.id);
      dados = prepararDados(tipo, req.body, false);
    } catch (erro) {
      return res.status(400).json({ erro: erro.message });
    }

    try {
      const campos = Object.keys(dados);
      const valores = Object.values(dados);

      const alteracoes = campos.map(
        (campo, indice) => `${campo} = $${indice + 1}`
      );

      valores.push(id);

      const resultado = await pool.query(
        `UPDATE ${tipo.tabela}
         SET ${alteracoes.join(", ")}
         WHERE id = $${valores.length}
         RETURNING *`,
        valores
      );

      if (!resultado.rows.length) {
        return res.status(404).json({
          erro: "Conteúdo não encontrado. Atualize a página."
        });
      }

      res.json({ item: resultado.rows[0] });
    } catch (erro) {
      responderErroBanco(erro, res, next);
    }
  });

  router.delete(`/${tipo.rota}/:id`, async (req, res, next) => {
    let id;

    try {
      id = validarId(req.params.id);
    } catch (erro) {
      return res.status(400).json({ erro: erro.message });
    }

    try {
      const resultado = await pool.query(
        `DELETE FROM ${tipo.tabela}
         WHERE id = $1
         RETURNING id`,
        [id]
      );

      if (!resultado.rows.length) {
        return res.status(404).json({
          erro: "Conteúdo não encontrado. Atualize a página."
        });
      }

      res.json({ ok: true });
    } catch (erro) {
      responderErroBanco(erro, res, next);
    }
  });
}

module.exports = router;
