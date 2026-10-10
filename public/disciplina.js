// ===================================================
// DISCIPLINA.JS — Página de uma disciplina
// ===================================================

const API = '/api';

let disciplinaAtual = null;
let ementaAtual = [];
let moduloEditandoId = null;
let filtroAtual = 'todos';
let timeoutBusca = null;

async function api(caminho, opcoes = {}) {
  const resp = await fetch(API + caminho, {
    headers: { 'Content-Type': 'application/json' },
    ...opcoes,
    body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro na requisição');
  return dados;
}

function mostrarMensagem(texto, tipo = 'ok') {
  const el = document.getElementById('mensagem');
  if (!el) return;
  el.textContent = texto;
  el.style.background = tipo === 'erro' ? '#f6e2e2' : '';
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 4000);
}

function escapar(texto) {
  if (texto == null) return '';
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pegarId() {
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function metricasModulo(mod) {
  let total = 0, concluidas = 0;
  mod.temas.forEach(t => {
    t.aulas.forEach(a => {
      total++;
      if (a.concluida) concluidas++;
    });
  });
  return { total, concluidas, todasConcluidas: total > 0 && concluidas === total };
}

async function carregarDisciplina() {
  const id = pegarId();
  const container = document.getElementById('modulos');

  if (!id) {
    document.getElementById('titulo-disciplina').textContent = 'Disciplina não encontrada';
    container.innerHTML = '<p class="erro">ID inválido na URL.</p>';
    return;
  }

  try {
    disciplinaAtual = await api(`/disciplinas/${id}`);

    document.title = `${disciplinaAtual.titulo} — Literatura Crítica e Comparada`;
    document.getElementById('titulo-disciplina').textContent = disciplinaAtual.titulo;

    if (disciplinaAtual.eixo) {
      document.getElementById('breadcrumb-eixo').textContent =
        `Eixo ${disciplinaAtual.eixo.numero} — ${disciplinaAtual.eixo.titulo}`;
    } else {
      document.getElementById('breadcrumb-eixo').textContent = 'Disciplina';
    }

    if (disciplinaAtual.eixo) {
      const urlEixo = `/eixo.html?numero=${disciplinaAtual.eixo.numero}`;
      document.getElementById('link-eixo').href = urlEixo;
      document.getElementById('link-eixo-rodape').href = urlEixo;
      document.getElementById('link-eixo-container').hidden = false;
      document.getElementById('link-eixo-rodape-container').hidden = false;
    }

    atualizarContagens();
    renderizarModulos();
    await carregarSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

function atualizarContagens() {
  let total = 0, concluidos = 0;
  disciplinaAtual.modulos.forEach(m => {
    const mm = metricasModulo(m);
    if (mm.total > 0) {
      total++;
      if (mm.todasConcluidas) concluidos++;
    }
  });
  document.querySelector('[data-contagem="todos"]').textContent = total;
  document.querySelector('[data-contagem="concluidos"]').textContent = concluidos;
  document.querySelector('[data-contagem="pendentes"]').textContent = total - concluidos;
}

function renderizarModulos() {
  const container = document.getElementById('modulos');
  if (!disciplinaAtual || !disciplinaAtual.modulos.length) {
    container.innerHTML = '<p class="vazio">Nenhum módulo cadastrado ainda.</p>';
    return;
  }

  const filtrados = disciplinaAtual.modulos.filter(m => {
    const mm = metricasModulo(m);
    if (filtroAtual === 'concluidos') return mm.total > 0 && mm.todasConcluidas;
    if (filtroAtual === 'pendentes') return mm.total === 0 || !mm.todasConcluidas;
    return true;
  });

  if (!filtrados.length) {
    container.innerHTML = '<p class="vazio">Nada por aqui com esse filtro.</p>';
    return;
  }

  container.innerHTML = filtrados.map(mod => {
    const mm = metricasModulo(mod);
    const textoAulas = mm.total === 0 ? 'Nenhuma aula ainda' : `${mm.concluidas}/${mm.total} aulas`;
    const classeConcluida = mm.todasConcluidas ? ' concluida' : '';

    return `
      <div class="cartao-eixo cartao-modulo${classeConcluida}">
        <button class="botao-check" data-acao="toggle-concluida" data-id="${mod.id}" type="button"
                title="${mm.todasConcluidas ? 'Desmarcar tudo' : 'Marcar tudo como concluído'}">
          ${mm.todasConcluidas ? '✓' : ''}
        </button>
        <a class="cartao-link" href="/modulo.html?id=${mod.id}">
          <span class="cartao-numero">Módulo</span>
          <h3 class="cartao-titulo">${escapar(mod.titulo)}</h3>
          <span class="cartao-contagem">${textoAulas}</span>
        </a>
        <div class="cartao-acoes">
          <button class="botao-editar" data-acao="editar-modulo" data-id="${mod.id}" type="button">Editar</button>
          <button class="botao-excluir" data-acao="excluir-modulo" data-id="${mod.id}" type="button">Excluir</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="editar-modulo"]').forEach(btn =>
    btn.addEventListener('click', abrirEditorEdicao));
  container.querySelectorAll('[data-acao="excluir-modulo"]').forEach(btn =>
    btn.addEventListener('click', excluirModulo));
  container.querySelectorAll('[data-acao="toggle-concluida"]').forEach(btn =>
    btn.addEventListener('click', toggleConcluida));
}

async function toggleConcluida(evento) {
  const id = evento.currentTarget.dataset.id;
  try {
    await api(`/modulos/${id}/concluida`, { method: 'PATCH' });
    await carregarDisciplina();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

async function carregarSubmenuEixos() {
  try {
    ementaAtual = await api('/ementa');
    const submenu = document.getElementById('submenu-eixos');
    if (!submenu) return;
    submenu.innerHTML = ementaAtual.map(e => `
      <li>
        <a href="/eixo.html?numero=${e.numero}">
          Eixo ${e.numero} — ${escapar(e.titulo)}
        </a>
      </li>
    `).join('');
  } catch {}
}

function abrirEditorNova() {
  moduloEditandoId = null;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Adicionar módulo';
  document.getElementById('erro-editor').hidden = true;
  dialog.showModal();
}

function abrirEditorEdicao(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  const mod = disciplinaAtual.modulos.find(m => m.id === id);
  if (!mod) return;
  moduloEditandoId = id;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Editar módulo';
  document.getElementById('erro-editor').hidden = true;
  form.titulo.value = mod.titulo || '';
  form.descricao.value = mod.descricao || '';
  dialog.showModal();
}

async function salvarEditor(evento) {
  evento.preventDefault();
  if (!disciplinaAtual) return;
  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    descricao: form.descricao?.value.trim() || null
  };
  try {
    if (moduloEditandoId) {
      await api(`/modulos/${moduloEditandoId}`, { method: 'PUT', body: dados });
      mostrarMensagem('Módulo atualizado 🌸');
    } else {
      dados.disciplina_id = disciplinaAtual.id;
      await api('/modulos', { method: 'POST', body: dados });
      mostrarMensagem('Módulo criado 🌸');
    }
    document.getElementById('dialogo-editor').close();
    moduloEditandoId = null;
    await carregarDisciplina();
  } catch (e) {
    document.getElementById('erro-editor').textContent = e.message;
    document.getElementById('erro-editor').hidden = false;
  }
}

async function excluirModulo(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir esse módulo? Apaga temas e aulas dentro. Não tem volta.')) return;
  try {
    await api(`/modulos/${id}`, { method: 'DELETE' });
    mostrarMensagem('Módulo excluído.');
    await carregarDisciplina();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

async function excluirDisciplina() {
  if (!disciplinaAtual) return;
  if (!confirm('Excluir essa disciplina? Apaga módulos, temas e aulas dentro. Não tem volta.')) return;
  try {
    await api(`/disciplinas/${disciplinaAtual.id}`, { method: 'DELETE' });
    mostrarMensagem('Disciplina excluída. Voltando...');
    setTimeout(() => {
      if (disciplinaAtual.eixo) {
        location.href = `/eixo.html?numero=${disciplinaAtual.eixo.numero}`;
      } else {
        location.href = '/';
      }
    }, 1200);
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

function configurarBusca() {
  const input = document.getElementById('busca-input');
  const resultados = document.getElementById('busca-resultados');
  if (!input || !resultados) return;

  input.addEventListener('input', () => {
    clearTimeout(timeoutBusca);
    const q = input.value.trim();
    if (!q) { resultados.innerHTML = ''; return; }
    timeoutBusca = setTimeout(() => executarBusca(q), 250);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.busca-container')) resultados.innerHTML = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = ''; resultados.innerHTML = ''; input.blur();
    }
  });
}

async function executarBusca(q) {
  const resultados = document.getElementById('busca-resultados');
  try {
    const itens = await api(`/buscar?q=${encodeURIComponent(q)}`);
    if (!itens.length) {
      resultados.innerHTML = '<div class="busca-vazio">Nada encontrado por aqui…</div>';
      return;
    }
    resultados.innerHTML = itens.map(item => {
      let url = item.url;
      if (!url) {
        if (item.tipo === 'eixo') url = `/eixo.html?numero=${item.id}`;
        else url = '/';
      }
      return `
        <a class="busca-item" href="${url}">
          <span class="busca-item-tipo" data-tipo="${item.tipo}">${item.tipo}</span>
          ${escapar(item.titulo)}
        </a>
      `;
    }).join('');
  } catch (e) {
    resultados.innerHTML = `<div class="busca-vazio">Erro: ${escapar(e.message)}</div>`;
  }
}

(function ativarCabecalhoSticky() {
  function atualizar() {
    const barra = document.getElementById('cabecalho-sticky');
    if (!barra) return;
    const h1 = document.querySelector('.cabecalho h1, header h1');
    const alvo = document.getElementById('cabecalho-sticky-titulo');
    if (h1 && alvo) alvo.textContent = h1.textContent;
    if (window.scrollY > 180) barra.classList.add('visivel');
    else barra.classList.remove('visivel');
  }
  function iniciar() {
    window.addEventListener('scroll', atualizar, { passive: true });
    window.addEventListener('resize', atualizar);
    [100, 300, 600, 1000, 2000].forEach(ms => setTimeout(atualizar, ms));
    atualizar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();

(function ativarBotoesFlutuantes() {
  function atualizar() {
    const c = document.querySelector('.botoes-flutuantes');
    if (!c) return;
    const a = document.documentElement.scrollHeight;
    const j = window.innerHeight;
    if (a > j + 200) c.classList.add('visivel');
    else c.classList.remove('visivel');
  }
  function iniciar() {
    const t = document.getElementById('ir-topo');
    const f = document.getElementById('ir-fundo');
    if (t) t.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    if (f) f.onclick = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    window.addEventListener('scroll', atualizar);
    window.addEventListener('resize', atualizar);
    if (window.ResizeObserver) new ResizeObserver(atualizar).observe(document.body);
    document.addEventListener('toggle', atualizar, true);
    atualizar();
    [100, 300, 600, 1000, 2000, 3000].forEach(ms => setTimeout(atualizar, ms));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();

document.addEventListener('DOMContentLoaded', async () => {
  await carregarDisciplina();
  configurarBusca();

  document.querySelectorAll('.filtro-capsula').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-capsula').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderizarModulos();
    });
  });

  document.getElementById('btn-add-modulo').addEventListener('click', abrirEditorNova);
  document.getElementById('btn-excluir-disciplina').addEventListener('click', excluirDisciplina);

  document.getElementById('form-editor').addEventListener('submit', salvarEditor);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
    moduloEditandoId = null;
  });

  const botaoEixos = document.getElementById('botao-eixos');
  const submenuEixos = document.getElementById('submenu-eixos');
  if (botaoEixos && submenuEixos) {
    botaoEixos.addEventListener('click', (e) => {
      e.stopPropagation();
      const aberto = !submenuEixos.hidden;
      submenuEixos.hidden = aberto;
      botaoEixos.setAttribute('aria-expanded', String(!aberto));
    });
    document.addEventListener('click', () => {
      if (!submenuEixos.hidden) {
        submenuEixos.hidden = true;
        botaoEixos.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const botaoBackup = document.getElementById('botao-backup');
  if (botaoBackup) {
    botaoBackup.addEventListener('click', async () => {
      try {
        const dados = await api('/ementa');
        const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const data = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `ementa-backup-${data}.json`;
        a.click();
        URL.revokeObjectURL(url);
        mostrarMensagem('Backup baixado 🌸');
      } catch (e) {
        mostrarMensagem('Erro ao gerar backup: ' + e.message, 'erro');
      }
    });
  }
});