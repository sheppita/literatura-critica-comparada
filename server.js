const path = require("node:path");
const express = require("express");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const { rateLimit } = require("express-rate-limit");
const helmet = require("helmet");

const pool = require("./db");
const inicializarBanco = require("./init-db");
const carregarEmenta = require("./dados");

const {
  senhaCorreta,
  obterTokenCsrf,
  verificarCsrf
} = require("./seguranca");

const app = express();
const porta = Number(process.env.PORT || 3000);
const producao = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.use(
  session({
    name: "ementa.sid",
    store: new PgSession({
      pool,
      tableName: "sessoes",
      createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || "nao-configurado",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: producao,
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

function tratarAsync(funcao) {
  return (req, res, next) => {
    Promise.resolve(funcao(req, res, next)).catch(next);
  };
}

function regenerarSessao(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((erro) => {
      if (erro) return reject(erro);
      resolve();
    });
  });
}

function salvarSessao(req) {
  return new Promise((resolve, reject) => {
    req.session.save((erro) => {
      if (erro) return reject(erro);
      resolve();
    });
  });
}

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    erro: "Muitas tentativas. Aguarde 15 minutos antes de tentar novamente."
  }
});

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/saude", (req, res) => {
  res.json({ ok: true });
});

app.get(
  "/api/ementa",
  tratarAsync(async (req, res) => {
    const ementa = await carregarEmenta();
    res.json({ eixos: ementa });
  })
);

app.get(
  "/api/sessao",
  tratarAsync(async (req, res) => {
    const csrfToken = obterTokenCsrf(req);
    await salvarSessao(req);

    res.json({
      autenticado: req.session.autenticado === true,
      csrfToken
    });
  })
);

app.post(
  "/api/login",
  limitarLogin,
  verificarCsrf,
  tratarAsync(async (req, res) => {
    if (!senhaCorreta(req.body?.senha)) {
      return res.status(401).json({
        erro: "Senha incorreta."
      });
    }

    await regenerarSessao(req);
    req.session.autenticado = true;

    const csrfToken = obterTokenCsrf(req);
    await salvarSessao(req);

    res.json({
      autenticado: true,
      csrfToken
    });
  })
);

app.post("/api/logout", verificarCsrf, (req, res, next) => {
  req.session.destroy((erro) => {
    if (erro) return next(erro);

    res.clearCookie("ementa.sid", {
      httpOnly: true,
      secure: producao,
      sameSite: "lax",
      path: "/"
    });

    res.json({ autenticado: false });
  });
});

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res) => {
  res.status(404).json({
    erro: "Página ou recurso não encontrado."
  });
});

app.use((erro, req, res, next) => {
  console.error("Não foi possível concluir uma operação.");

  if (res.headersSent) {
    return next(erro);
  }

  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({
      erro: "Os dados enviados estão em um formato inválido."
    });
  }

  if (erro.type === "entity.too.large") {
    return res.status(413).json({
      erro: "O conteúdo enviado é muito grande."
    });
  }

  res.status(500).json({
    erro: "Não foi possível concluir a operação. Tente novamente mais tarde."
  });
});

async function iniciar() {
  if (
    !process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32
  ) {
    throw new Error(
      "Configure SESSION_SECRET com pelo menos 32 caracteres no Render."
    );
  }

  if (
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 16
  ) {
    throw new Error(
      "Configure ADMIN_PASSWORD com pelo menos 16 caracteres no Render."
    );
  }

  await inicializarBanco();

  app.listen(porta, "0.0.0.0", () => {
    console.log("Site iniciado.");
  });
}

iniciar().catch(() => {
  console.error(
    "O site não iniciou. Verifique as configurações e a conexão com o banco."
  );
  process.exitCode = 1;
});
