import express from 'express';
import pool from './db.js';

const router = express.Router();

// ---------- UTIL: normalizar texto pra comparação ----------
function normalizar(texto) {
  if (!texto) return '';
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- UTIL: ordenação "natural" ----------
function ordenarPorTitulo(a, b) {
  const extrairNumero = (t) => {
    const match = String(t || '').match(/^\s*(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const numA = extrairNumero(a.titulo);
  const numB = extrairNumero(b.titulo);

  if (numA !== null && numB !== null) {
    if (numA !== numB) return numA - numB;
    return normalizar(a.titulo).localeCompare(normalizar(b.titulo));
  }
  if (numA !== null) return -1;
  if (numB !== null) return 1;
  return normalizar(a.titulo).localeCompare(normalizar(b.titulo));
}

// ===================================================
// EMENTA COMPLETA
// ===================================================
router.get('/ementa', async (req, res) => {
  try {
    const eixos = (await pool.query('SELECT * FROM eixos ORDER BY numero')).rows;
    const disciplinas = (await pool.query('SELECT * FROM disciplinas')).rows;
    const modulos = (await pool.query('SELECT * FROM modulos')).rows;
    const temas = (await pool.query('SELECT * FROM temas')).rows;
    const aulas = (await pool.query('SELECT * FROM aulas')).rows;

    const aulasIds = aulas.map(a => a.id);
    let livros = [];
    if (aulasIds.length) {
      livros = (await pool.query(
        'SELECT * FROM livros WHERE aula_id = ANY($1) ORDER BY id', [aulasIds]
      )).rows;
    }

    const arvore = eixos.map(e => ({
      ...e,
      disciplinas: disciplinas
        .filter(d => d.eixo_id === e.id)
        .sort(ordenarPorTitulo)
        .map(d => ({
          ...d,
          modulos: modulos
            .filter(m => m.disciplina_id === d.id)
            .sort(ordenarPorTitulo)
            .map(m => ({
              ...m,
              temas: temas
                .filter(t => t.modulo_id === m.id)
                .sort(ordenarPorTitulo)
                .map(t => ({
                  ...t,
                  aulas: aulas
                    .filter(a => a.tema_id === t.id)
                    .sort(ordenarPorTitulo)
                    .map(a => ({
                      ...a,
                      livros: livros.filter(l => l.aula_id === a.id)
                    }))
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

// ===================================================
// ITENS INDIVIDUAIS
// ===================================================
router.get('/disciplinas/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const disc = (await pool.query('SELECT * FROM disciplinas WHERE id = $1', [id])).rows[0];
    if (!disc) return res.status(404).json({ erro: 'Disciplina não encontrada.' });

    const eixo = (await pool.query(
      'SELECT numero, titulo FROM eixos WHERE id = $1', [disc.eixo_id]
    )).rows[0];

    const modulos = (await pool.query(
      'SELECT * FROM modulos WHERE disciplina_id = $1', [id]
    )).rows.sort(ordenarPorTitulo);

    const modulosIds = modulos.map(m => m.id);
    let temas = [], aulas = [], livros = [];
    if (modulosIds.length) {
      temas = (await pool.query(
        'SELECT * FROM temas WHERE modulo_id = ANY($1)', [modulosIds]
      )).rows;
      const temasIds = temas.map(t => t.id);
      if (temasIds.length) {
        aulas = (await pool.query(
          'SELECT * FROM aulas WHERE tema_id = ANY($1)', [temasIds]
        )).rows;
        const aulasIds = aulas.map(a => a.id);
        if (aulasIds.length) {
          livros = (await pool.query(
            'SELECT * FROM livros WHERE aula_id = ANY($1)', [aulasIds]
          )).rows;
        }
      }
    }

    res.json({
      ...disc,
      eixo,
      modulos: modulos.map(m => ({
        ...m,
        temas: temas
          .filter(t => t.modulo_id === m.id)
          .sort(ordenarPorTitulo)
          .map(t => ({
            ...t,
            aulas: aulas
              .filter(a => a.tema_id === t.id)
              .sort(ordenarPorTitulo)
              .map(a => ({
                ...a,
                livros: livros.filter(l => l.aula_id === a.id)
              }))
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
    const mod = (await pool.query('SELECT * FROM modulos WHERE id = $1', [id])).rows[0];
    if (!mod) return res.status(404).json({ erro: 'Módulo não encontrado.' });

    const disc = (await pool.query(
      'SELECT * FROM disciplinas WHERE id = $1', [mod.disciplina_id]
    )).rows[0];

    const eixo = disc ? (await pool.query(
      'SELECT numero, titulo FROM eixos WHERE id = $1', [disc.eixo_id]
    )).rows[0] : null;

    const temas = (await pool.query(
      'SELECT * FROM temas WHERE modulo_id = $1', [id]
    )).rows.sort(ordenarPorTitulo);

    const temasIds = temas.map(t => t.id);
    let aulas = [], livros = [];
    if (temasIds.length) {
      aulas = (await pool.query(
        'SELECT * FROM aulas WHERE tema_id = ANY($1)', [temasIds]
      )).rows;
      const aulasIds = aulas.map(a => a.id);
      if (aulasIds.length) {
        livros = (await pool.query(
          'SELECT * FROM livros WHERE aula_id = ANY($1)', [aulasIds]
        )).rows;
      }
    }

    res.json({
      ...mod,
      disciplina: disc ? { id: disc.id, titulo: disc.titulo } : null,
      eixo,
      temas: temas.map(t => ({
        ...t,
        aulas: aulas
          .filter(a => a.tema_id === t.id)
          .sort(ordenarPorTitulo)
          .map(a => ({
            ...a,
            livros: livros.filter(l => l.aula_id === a.id)
          }))
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
    const tema = (await pool.query('SELECT * FROM temas WHERE id = $1', [id])).rows[0];
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
      'SELECT * FROM aulas WHERE tema_id = $1', [id]
    )).rows.sort(ordenarPorTitulo);

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
router.post('/disciplinas', async (req, res) => {
  const { eixo_id, titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO disciplinas (eixo_id, titulo, descricao) VALUES ($1,$2,$3) RETURNING *',
    [eixo_id, titulo, descricao]
  );
  res.json(rows[0]);
});

router.put('/disciplinas/:id', async (req, res) => {
  const { titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'UPDATE disciplinas SET titulo=$1, descricao=$2 WHERE id=$3 RETURNING *',
    [titulo, descricao, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Disciplina não encontrada.' });
  res.json(rows[0]);
});

router.delete('/disciplinas/:id', async (req, res) => {
  await pool.query('DELETE FROM disciplinas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- MÓDULOS ----------
router.post('/modulos', async (req, res) => {
  const { disciplina_id, titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO modulos (disciplina_id, titulo, descricao) VALUES ($1,$2,$3) RETURNING *',
    [disciplina_id, titulo, descricao]
  );
  res.json(rows[0]);
});

router.put('/modulos/:id', async (req, res) => {
  const { titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'UPDATE modulos SET titulo=$1, descricao=$2 WHERE id=$3 RETURNING *',
    [titulo, descricao, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Módulo não encontrado.' });
  res.json(rows[0]);
});

router.delete('/modulos/:id', async (req, res) => {
  await pool.query('DELETE FROM modulos WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- TEMAS ----------
router.post('/temas', async (req, res) => {
  const { modulo_id, titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO temas (modulo_id, titulo, descricao) VALUES ($1,$2,$3) RETURNING *',
    [modulo_id, titulo, descricao]
  );
  res.json(rows[0]);
});

router.put('/temas/:id', async (req, res) => {
  const { titulo, descricao } = req.body;
  const { rows } = await pool.query(
    'UPDATE temas SET titulo=$1, descricao=$2 WHERE id=$3 RETURNING *',
    [titulo, descricao, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ erro: 'Tema não encontrado.' });
  res.json(rows[0]);
});

router.delete('/temas/:id', async (req, res) => {
  await pool.query('DELETE FROM temas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- AULAS ----------
router.post('/aulas', async (req, res) => {
  const { tema_id, titulo, conteudo } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO aulas (tema_id, titulo, conteudo) VALUES ($1,$2,$3) RETURNING *',
    [tema_id, titulo, conteudo]
  );
  res.json(rows[0]);
});

router.put('/aulas/:id', async (req, res) => {
  const { titulo, conteudo } = req.body;
  const { rows } = await pool.query(
    'UPDATE aulas SET titulo=$1, conteudo=$2 WHERE id=$3 RETURNING *',
    [titulo, conteudo, req.params.id]
  );
  res.json(rows[0]);
});

// Alternar concluída de UMA aula
router.patch('/aulas/:id/concluida', async (req, res) => {
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

router.delete('/aulas/:id', async (req, res) => {
  await pool.query('DELETE FROM aulas WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ===================================================
// MARCAR/desmarcar TEMA, MÓDULO, DISCIPLINA, EIXO
// (marca/desmarca TODAS as aulas dentro)
// ===================================================

// Tema → todas as aulas do tema
router.patch('/temas/:id/concluida', async (req, res) => {
  try {
    const temaId = Number(req.params.id);
    const { rows: aulas } = await pool.query(
      'SELECT id, concluida FROM aulas WHERE tema_id = $1', [temaId]
    );
    if (!aulas.length) return res.status(404).json({ erro: 'Tema sem aulas.' });

    // Se TODAS já estão concluídas → desmarca. Senão → marca todas.
    const todasConcluidas = aulas.every(a => a.concluida);
    const novoValor = !todasConcluidas;

    await pool.query(
      'UPDATE aulas SET concluida = $1 WHERE tema_id = $2',
      [novoValor, temaId]
    );
    res.json({ ok: true, concluida: novoValor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar tema.' });
  }
});

// Módulo → todas as aulas dos temas dele
router.patch('/modulos/:id/concluida', async (req, res) => {
  try {
    const modId = Number(req.params.id);
    const { rows: aulas } = await pool.query(
      `SELECT a.id, a.concluida
       FROM aulas a
       JOIN temas t ON t.id = a.tema_id
       WHERE t.modulo_id = $1`,
      [modId]
    );
    if (!aulas.length) return res.status(404).json({ erro: 'Módulo sem aulas.' });

    const todasConcluidas = aulas.every(a => a.concluida);
    const novoValor = !todasConcluidas;

    await pool.query(
      `UPDATE aulas SET concluida = $1
       WHERE tema_id IN (SELECT id FROM temas WHERE modulo_id = $2)`,
      [novoValor, modId]
    );
    res.json({ ok: true, concluida: novoValor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar módulo.' });
  }
});

// Disciplina → todas as aulas dos módulos dela
router.patch('/disciplinas/:id/concluida', async (req, res) => {
  try {
    const discId = Number(req.params.id);
    const { rows: aulas } = await pool.query(
      `SELECT a.id, a.concluida
       FROM aulas a
       JOIN temas t   ON t.id = a.tema_id
       JOIN modulos m ON m.id = t.modulo_id
       WHERE m.disciplina_id = $1`,
      [discId]
    );
    if (!aulas.length) return res.status(404).json({ erro: 'Disciplina sem aulas.' });

    const todasConcluidas = aulas.every(a => a.concluida);
    const novoValor = !todasConcluidas;

    await pool.query(
      `UPDATE aulas SET concluida = $1
       WHERE tema_id IN (
         SELECT t.id FROM temas t
         JOIN modulos m ON m.id = t.modulo_id
         WHERE m.disciplina_id = $2
       )`,
      [novoValor, discId]
    );
    res.json({ ok: true, concluida: novoValor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar disciplina.' });
  }
});

// Eixo → todas as aulas das disciplinas dele
router.patch('/eixos/:numero/concluida', async (req, res) => {
  try {
    const numero = Number(req.params.numero);
    const { rows: aulas } = await pool.query(
      `SELECT a.id, a.concluida
       FROM aulas a
       JOIN temas t       ON t.id = a.tema_id
       JOIN modulos m     ON m.id = t.modulo_id
       JOIN disciplinas d ON d.id = m.disciplina_id
       JOIN eixos e       ON e.id = d.eixo_id
       WHERE e.numero = $1`,
      [numero]
    );
    if (!aulas.length) return res.status(404).json({ erro: 'Eixo sem aulas.' });

    const todasConcluidas = aulas.every(a => a.concluida);
    const novoValor = !todasConcluidas;

    await pool.query(
      `UPDATE aulas SET concluida = $1
       WHERE tema_id IN (
         SELECT t.id FROM temas t
         JOIN modulos m     ON m.id = t.modulo_id
         JOIN disciplinas d ON d.id = m.disciplina_id
         JOIN eixos e       ON e.id = d.eixo_id
         WHERE e.numero = $2
       )`,
      [novoValor, numero]
    );
    res.json({ ok: true, concluida: novoValor });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar eixo.' });
  }
});

// ===================================================
// LIVROS / BIBLIOGRAFIA
// ===================================================
router.get('/livros', async (req, res) => {
  try {
    const sql = `
      SELECT
        l.*,
        a.titulo  AS aula_titulo,
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
      ORDER BY l.id DESC
    `;
    const { rows } = await pool.query(sql);

    const mapa = new Map();
    rows.forEach(l => {
      const chave = [normalizar(l.titulo), normalizar(l.autor), normalizar(l.capitulo)].join('||');
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(l.id);
    });

    const comFlag = rows.map(l => {
      const chave = [normalizar(l.titulo), normalizar(l.autor), normalizar(l.capitulo)].join('||');
      const ids = mapa.get(chave) || [];
      return { ...l, repetido: ids.length > 1, ocorrencias: ids.length };
    });

    res.json(comFlag);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao carregar bibliografia.' });
  }
});

router.get('/aulas/:id/livros', async (req, res) => {
  try {
    const aulaId = Number(req.params.id);

    const meus = (await pool.query(
      'SELECT * FROM livros WHERE aula_id = $1 ORDER BY id', [aulaId]
    )).rows;

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

router.post('/livros', async (req, res) => {
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

router.put('/livros/:id', async (req, res) => {
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

router.delete('/livros/:id', async (req, res) => {
  await pool.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default router;