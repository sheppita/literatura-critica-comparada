import express from 'express';
import pool from './db.js';

const router = express.Router();

// ---------- MIDDLEWARE DE LOGIN ----------
function exigirLogin(req, res, next) {
  if (req.cookies?.admin === process.env.SENHA_ADMIN) return next();
  return res.status(401).json({ erro: 'Faça login para continuar.' });
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

// ---------- ITENS INDIVIDUAIS (públicos) ----------

// Disciplina + módulos + temas + aulas
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

    const arvore = {
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
    };

    res.json(arvore);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar disciplina.' });
  }
});

// Módulo + temas + aulas
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

    const arvore = {
      ...mod,
      disciplina: disc ? { id: disc.id, titulo: disc.titulo } : null,
      eixo,
      temas: temas.map(t => ({
        ...t,
        aulas: aulas.filter(a => a.tema_id === t.id)
      }))
    };

    res.json(arvore);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar módulo.' });
  }
});

// Tema + aulas
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

    res.json({
      ...tema,
      modulo: mod ? { id: mod.id, titulo: mod.titulo } : null,
      disciplina: disc ? { id: disc.id, titulo: disc.titulo } : null,
      eixo,
      aulas
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar tema.' });
  }
});


// ---------- BUSCA (pública) ----------
router.get('/buscar', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const termo = `%${q}%`;
  const sql = `
    SELECT 'disciplina' AS tipo, id, titulo FROM disciplinas WHERE titulo ILIKE $1
    UNION ALL
    SELECT 'modulo',     id, titulo FROM modulos     WHERE titulo ILIKE $1
    UNION ALL
    SELECT 'tema',       id, titulo FROM temas       WHERE titulo ILIKE $1
    UNION ALL
    SELECT 'aula',       id, titulo FROM aulas       WHERE titulo ILIKE $1 OR conteudo ILIKE $1
    LIMIT 50;
  `;
  const { rows } = await pool.query(sql, [termo]);
  res.json(rows);
});

// ===================================================
// CADASTRO (exige login)
// ===================================================

router.post('/disciplinas', exigirLogin, async (req, res) => {
  const { eixo_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO disciplinas (eixo_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [eixo_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.delete('/disciplinas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM disciplinas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/modulos', exigirLogin, async (req, res) => {
  const { disciplina_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO modulos (disciplina_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [disciplina_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.delete('/modulos/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM modulos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/temas', exigirLogin, async (req, res) => {
  const { modulo_id, titulo, descricao, ordem } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO temas (modulo_id, titulo, descricao, ordem) VALUES ($1,$2,$3,$4) RETURNING *',
    [modulo_id, titulo, descricao, ordem || 0]
  );
  res.json(rows[0]);
});

router.delete('/temas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM temas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

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

router.delete('/aulas/:id', exigirLogin, async (req, res) => {
  await pool.query('DELETE FROM aulas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Alternar status concluída da aula
router.patch('/aulas/:id/concluida', exigirLogin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE aulas
       SET concluida = NOT concluida
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Aula não encontrada.' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar aula.' });
  }
});

export default router;