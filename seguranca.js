const crypto = require("node:crypto");

function compararTextos(textoA, textoB) {
  const resumoA = crypto
    .createHash("sha256")
    .update(textoA, "utf8")
    .digest();

  const resumoB = crypto
    .createHash("sha256")
    .update(textoB, "utf8")
    .digest();

  return crypto.timingSafeEqual(resumoA, resumoB);
}

function senhaCorreta(senhaInformada) {
  const senhaConfigurada = process.env.ADMIN_PASSWORD;

  if (
    typeof senhaInformada !== "string" ||
    senhaInformada.length > 1024 ||
    !senhaConfigurada
  ) {
    return false;
  }

  return compararTextos(senhaInformada, senhaConfigurada);
}

function exigirLogin(req, res, next) {
  if (!req.session || req.session.autenticado !== true) {
    return res.status(401).json({
      erro: "Entre na área de edição para continuar."
    });
  }

  next();
}

function obterTokenCsrf(req) {
  if (!req.session) {
    throw new Error("A sessão precisa estar configurada.");
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto
      .randomBytes(32)
      .toString("hex");
  }

  return req.session.csrfToken;
}

function verificarCsrf(req, res, next) {
  const tokenRecebido = req.get("X-CSRF-Token");
  const tokenEsperado = req.session?.csrfToken;

  if (
    typeof tokenRecebido !== "string" ||
    tokenRecebido.length !== 64 ||
    typeof tokenEsperado !== "string" ||
    !compararTextos(tokenRecebido, tokenEsperado)
  ) {
    return res.status(403).json({
      erro: "Atualize a página e tente novamente."
    });
  }

  next();
}

module.exports = {
  senhaCorreta,
  exigirLogin,
  obterTokenCsrf,
  verificarCsrf
};
