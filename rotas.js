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

export default router;