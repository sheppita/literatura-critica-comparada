import express from 'express';
import pool from './db.js';

const router = express.Router();

// ---------- MIDDLEWARE DE LOGIN ----------
function exigirLogin(req, res, next) {
  if (req.cookies?.admin === process.env.SENHA_ADMIN) return next();
  return res.status(401).json({ erro: 'Faça login para continuar.' });
}

// ---------- UTIL: normalizar texto pra comparação ----------
function normalizar(texto) {
  if (!texto) return '';
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/\s+/g, ' ')              // colapsa espaços
    .trim();
}

// ---------- LOGIN ----------
router.post('/login', (req, res) => {
  const { senha } = req.body;
  if (senha === process.env.SENHA_ADMIN) {
    res.cookie('admin', senha, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
    return res.json({ ok: true });
  }
  res.status(401).json({ erro: 'Senha incorreta.' });
});

router.post('/logout', (req, res) => {
  res.clearCookie('admin');
  res.json({ ok: true });
});

router.get('/sessao', (req, res) => {
  res.json({ logada: req.cookies?.admin === process.env.SENHA_ADMIN });
});

// ---------- EMENTA COMPLETA (pública) ----------
router.get('/ementa', async (req, res) => {
  try {
    const eixos = (await pool.query('SELECT * FROM eixos ORDER BY numero')).rows;
    const disciplinas = (await pool.query('SELECT * FROM disciplinas ORDER BY ordem, id')).rows;
    const modulos = (await pool.query('SELECT * FROM modulos ORDER BY ordem, id')).rows;
    const temas = (await pool.query('SELECT * FROM temas ORDER BY ordem, id')).rows;
    const aulas = (await pool.query('SELECT * FROM aulas ORDER BY ordem, id')).rows;

    const arvore = eixos.map(e => ({
      ...e,
      disciplinas: disciplinas
        .filter(d => d.eixo_id === e.id)
        .map(d => ({
          ...d,
          modulos: modulos
            .filter(m => m.disciplina_id === d.id)
            .map(m => ({
              ...m,
              temas: temas
                .filter(t => t.modulo_id === m.id)
                .map(t => ({
                  ...t,
                  aulas: aulas.filter(a => a.tema_id === t.id)
                }))
            }))
        }))
    }));

    res.json(arvore);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar ementa.' });
  }
});

// ---------- ITENS INDIVIDUAIS ----------

router.get('/disciplinas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const disc = (await pool.query(
      'SELECT * FROM disciplinas WHERE id = $1', [id]
    )).rows[0];

    if (!disc) return res.status(404).json({ erro: 'Disciplina não encontrada.' });

    const eixo = (await pool.query(
      'SELECT numero, titulo FROM eixos WHERE id = $1', [disc.eixo_id]
    )).rows[0];

    const modulos = (await pool.query(
      'SELECT * FROM modulos WHERE disciplina_id = $1 ORDER BY ordem, id', [id]
    )).rows;

    const modulosIds = modulos.map(m => m.id);

    let temas = [], aulas = [];
    if (modulosIds.length) {
      temas = (await pool.query(
        'SELECT * FROM temas WHERE modulo_id = ANY($1) ORDER BY ordem, id', [modulosIds]
      )).rows;

      const temasIds = temas.map(t => t.id);
      if (temasIds.length) {
        aulas = (await pool.query(
          'SELECT * FROM aulas WHERE tema_id = ANY($1) ORDER BY ordem, id', [temasIds]
        )).rows;
      }
    }

    res.json({
      ...disc,
      eixo,
      modulos: modulos.map(m => ({
        ...m,
        temas: temas
          .filter(t => t.modulo_id === m.id)
          .map(t => ({
            ...t,
            aulas: aulas.filter(a => a.tema_id === t.id)
          }))
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar disciplina.' });
  }
});

router.get('/modulos/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const mod = (await pool.query(
      'SELECT * FROM modulos WHERE id = $1', [id]
    )).rows[0];

    if (!mod) return res.status(404).json({ erro: 'Módulo não encontrado.' });

    const disc = (await pool.query(
      'SELECT * FROM disciplinas WHERE id = $1', [mod.disciplina_id]
    )).rows[0];

    const eixo = disc ? (await pool.query(
      'SELECT numero, titulo FROM eixos WHERE id = $1', [disc.eixo_id]
    )).rows[0] : null;

    const temas = (await pool.query(
      'SELECT * FROM temas WHERE modulo_id = $1 ORDER BY ordem, id', [id]
    )).rows;

    const temasIds = temas.map(t => t.id);
    let aulas = [];
    if (temasIds.length) {
      aulas = (await pool.query(
        'SELECT * FROM aulas WHERE tema_id = ANY($1) ORDER BY ordem, id', [temasIds]
      )).rows;
    }

    res.json({
      ...mod,
      disciplina: disc ? { id: disc.id, titulo: disc.titulo } : null,
      eixo,
      temas: temas.map(t => ({
        ...t,
        aulas: aulas.filter(a => a.tema_id === t.id)
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar módulo.' });
  }
});

router.get('/temas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    const tema = (await pool.query(
      'SELECT * FROM temas WHERE id = $1', [id]
    )).rows[0];

    if (!tema) return res.status(404).json({ erro: 'Tema não encontrado.' });

    const mod = (await pool.query(
      'SELECT * FROM modulos WHERE id = $1', [tema.modulo_id]
    )).rows[0];

    const disc = mod ? (await pool.query(
      'SELECT * FROM disciplinas WHERE id = $1', [mod.disciplina_id]
    )).rows[0] : null;

    const eixo = disc ? (await pool.query(
      'SELECT numero, titulo FROM eixos WHERE id = $1', [disc.eixo_id]
    )).rows[0] : null;

    const aulas = (await pool.query(
      'SELECT * FROM aulas WHERE tema_id = $1 ORDER BY ordem, id', [id]
    )).rows;

    // Anexa livros a cada aula
    const aulasIds = aulas.map(a => a.id);
    let livros = [];
    if (aulasIds.length) {
      livros = (await pool.query(
        'SELECT * FROM livros WHERE aula_id = ANY($1) ORDER BY id', [aulasIds]
      )).rows;
    }

    res.json({
      ...tema,
      modulo: mod ? { id: mod.id, titulo: mod.titulo } : null,
      disciplina: disc ? { id: disc.id, titulo: disc.titulo } : null,
      eixo,
      aulas: aulas.map(a => ({
        ...a,
        livros: livros.filter(l => l.aula_id === a.id)
      }))
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar tema.' });
  }
});

// ---------- BUSCA ----------
router.get('/buscar', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const termo = `%${q}%`;
  try {
    const sql = `
      SELECT 'eixo' AS tipo, id, titulo, NULL AS url, numero AS extra
        FROM eixos WHERE titulo ILIKE $1
      UNION ALL
      SELECT 'disciplina', id, titulo, '/disciplina.html?id=' || id, NULL
        FROM disciplinas WHERE titulo ILIKE $1 OR descricao ILIKE $1
      UNION ALL
      SELECT 'modulo', id, titulo, '/modulo.html?id=' || id, NULL
        FROM modulos WHERE titulo ILIKE $1 OR descricao ILIKE $1
      UNION ALL
      SELECT 'tema', id, titulo, '/tema.html?id=' || id, NULL
        FROM temas WHERE titulo ILIKE $1 OR descricao ILIKE $1
      UNION ALL
      SELECT 'aula', id, titulo, NULL, NULL
        FROM aulas WHERE titulo ILIKE $1 OR conteudo ILIKE $1
      UNION ALL
      SELECT 'livro', id, titulo, NULL, NULL
        FROM livros WHERE titulo ILIKE $1 OR autor ILIKE $1
      LIMIT 50;
    `;
    const { rows } = await pool.query(sql, [termo]);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro na busca.' });
  }
});

// ===================================================
// CADASTRO — DISCIPLINAS
// ===================================================
router.post('/disciplinas', exigirLogin, async (req, res) => {
  const { eixo_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO disciplinas (eixo_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [eixo_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.put('/disciplinas/:id', exigirLogin, async (req, res) => {
  const { titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'UPDATE disciplinas SET titulo=$1, descricao=$2, ordem=$3 WHERE id=$4 RETURNING *',
    [titulo, descricao, ordem || 0, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Disciplina não encontrada.' });
  res.json(rows[0]);
});

router.delete('/disciplinas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM disciplinas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- MÓDULOS ----------
router.post('/modulos', exigirLogin, async (req, res) => {
  const { disciplina_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO modulos (disciplina_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [disciplina_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.put('/modulos/:id', exigirLogin, async (req, res) => {
  const { titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'UPDATE modulos SET titulo=$1, descricao=$2, ordem=$3 WHERE id=$4 RETURNING *',
    [titulo, descricao, ordem || 0, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Módulo não encontrado.' });
  res.json(rows[0]);
});

router.delete('/modulos/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM modulos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- TEMAS ----------
router.post('/temas', exigirLogin, async (req, res) => {
  const { modulo_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO temas (modulo_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [modulo_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.put('/temas/:id', exigirLogin, async (req, res) => {
  const { titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'UPDATE temas SET titulo=$1, descricao=$2, ordem=$3 WHERE id=$4 RETURNING *',
    [titulo, descricao, ordem || 0, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Tema não encontrado.' });
  res.json(rows[0]);
});

router.delete('/temas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM temas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- AULAS ----------
router.post('/aulas', exigirLogin, async (req, res) => {
  const { tema_id, titulo, conteudo, links, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO aulas (tema_id, titulo, conteudo, links, ordem) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [tema_id, titulo, conteudo, links, ordem || 0]
  );
  res.json(rows[0]);
});

router.put('/aulas/:id', exigirLogin, async (req, res) => {
  const { titulo, conteudo, links } = req.body;
  const { rows } = await pool.query(
    'UPDATE aulas SET titulo=$1, conteudo=$2, links=$3 WHERE id=$4 RETURNING *',
    [titulo, conteudo, links, req.params.id]
  );
  res.json(rows[0]);
});

router.patch('/aulas/:id/concluida', exigirLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE aulas SET concluida = NOT concluida WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Aula não encontrada.' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar aula.' });
  }
});

router.delete('/aulas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM aulas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ===================================================
// LIVROS / BIBLIOGRAFIA
// ===================================================

// Lista TODOS os livros com contexto (aula, tema, módulo, disciplina, eixo)
// + flag de repetido (mesmo título + autor + capítulo em outra aula)
router.get('/livros', async (req, res) => {
  try {
    const sql = `
      SELECT
        l.*,
        a.titulo  AS aula_titulo,
        a.id      AS aula_id,
        t.id      AS tema_id,
        t.titulo  AS tema_titulo,
        m.id      AS modulo_id,
        m.titulo  AS modulo_titulo,
        d.id      AS disciplina_id,
        d.titulo  AS disciplina_titulo,
        e.numero  AS eixo_numero,
        e.titulo  AS eixo_titulo
      FROM livros l
      JOIN aulas a       ON a.id = l.aula_id
      JOIN temas t       ON t.id = a.tema_id
      JOIN modulos m     ON m.id = t.modulo_id
      JOIN disciplinas d ON d.id = m.disciplina_id
      JOIN eixos e       ON e.id = d.eixo_id
      ORDER BY l.criado_em DESC, l.id DESC
    `;
    const { rows } = await pool.query(sql);

    // Detecta repetidos: mesma normalização de título+autor+capítulo
    const mapa = new Map();
    rows.forEach(l => {
      const chave = [
        normalizar(l.titulo),
        normalizar(l.autor),
        normalizar(l.capitulo)
      ].join('||');
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(l.id);
    });

    const comFlag = rows.map(l => {
      const chave = [
        normalizar(l.titulo),
        normalizar(l.autor),
        normalizar(l.capitulo)
      ].join('||');
      const ids = mapa.get(chave) || [];
      return {
        ...l,
        repetido: ids.length > 1,
        ocorrencias: ids.length
      };
    });

    res.json(comFlag);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar bibliografia.' });
  }
});

// Lista livros de UMA aula + avisa se já foi usado em outra
router.get('/aulas/:id/livros', async (req, res) => {
  try {
    const aulaId = Number(req.params.id);

    const meus = (await pool.query(
      'SELECT * FROM livros WHERE aula_id = $1 ORDER BY id', [aulaId]
    )).rows;

    // Pra cada livro, busca em outras aulas
    const resultado = [];
    for (const l of meus) {
      const outros = (await pool.query(
        `SELECT l2.id, l2.aula_id, a.titulo AS aula_titulo,
                t.titulo AS tema_titulo, m.titulo AS modulo_titulo,
                d.titulo AS disciplina_titulo,
                e.numero AS eixo_numero, e.titulo AS eixo_titulo
         FROM livros l2
         JOIN aulas a       ON a.id = l2.aula_id
         JOIN temas t       ON t.id = a.tema_id
         JOIN modulos m     ON m.id = t.modulo_id
         JOIN disciplinas d ON d.id = m.disciplina_id
         JOIN eixos e       ON e.id = d.eixo_id
         WHERE l2.id <> $1
           AND l2.aula_id <> $2
           AND lower(unaccent(l2.titulo)) = lower(unaccent($3))
           AND COALESCE(lower(unaccent(l2.autor)), '') = COALESCE(lower(unaccent($4)), '')
           AND COALESCE(lower(unaccent(l2.capitulo)), '') = COALESCE(lower(unaccent($5)), '')
         ORDER BY l2.id`,
        [l.id, aulaId, l.titulo, l.autor, l.capitulo]
      )).rows;

      resultado.push({ ...l, usadoEm: outros });
    }

    res.json(resultado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar livros da aula.' });
  }
});

// Criar livro
router.post('/livros', exigirLogin, async (req, res) => {
  const { aula_id, titulo, autor, capitulo, descricao_capitulo, tipo, observacoes } = req.body;

  if (!aula_id || !titulo || !tipo) {
    return res.status(400).json({ erro: 'Aula, título e tipo são obrigatórios.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO livros (aula_id, titulo, autor, capitulo, descricao_capitulo, tipo, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [aula_id, titulo, autor, capitulo, descricao_capitulo, tipo, observacoes]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar livro.' });
  }
});

// Editar livro
router.put('/livros/:id', exigirLogin, async (req, res) => {
  const { titulo, autor, capitulo, descricao_capitulo, tipo, observacoes } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE livros
       SET titulo=$1, autor=$2, capitulo=$3, descricao_capitulo=$4, tipo=$5, observacoes=$6
       WHERE id=$7 RETURNING *`,
      [titulo, autor, capitulo, descricao_capitulo, tipo, observacoes, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Livro não encontrado.' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao editar livro.' });
  }
});

// Excluir livro
router.delete('/livros/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;