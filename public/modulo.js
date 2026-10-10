// ===================================================
// MODULO.JS — Página de um módulo
// ===================================================

const API = '/api';

let moduloAtual = null;
let ementaAtual = [];
let temaEditandoId = null;
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

function metricasTema(tema) {
  const total = tema.aulas.length;
  const concluidas = tema.aulas.filter(a => a.concluida).length;
  return { total, concluidas, todasConcluidas: total > 0 && concluidas === total };
}

async function carregarModulo() {
  const id = pegarId();
  const container = document.getElementById('temas');

  if (!id) {
    document.getElementById('titulo-modulo').textContent = 'Módulo não encontrado';
    container.innerHTML = '<p class="erro">ID inválido na URL.</p>';
    return;
  }

  try {
    moduloAtual = await api(`/modulos/${id}`);

    document.title = `${moduloAtual.titulo} — Literatura Crítica e Comparada`;
    document.getElementById('titulo-modulo').textContent = moduloAtual.titulo;

    if (moduloAtual.eixo) {
      document.getElementById('breadcrumb-eixo').textContent =
        `Eixo ${moduloAtual.eixo.numero} — ${moduloAtual.eixo.titulo}`;
    } else {
      document.getElementById('breadcrumb-eixo').textContent = 'Módulo';
    }

    if (moduloAtual.eixo) {
      const urlEixo = `/eixo.html?numero=${moduloAtual.eixo.numero}`;
      document.getElementById('link-eixo').href = urlEixo;
      document.getElementById('link-eixo-rodape').href = urlEixo;
      document.getElementById('link-eixo-container').hidden = false;
      document.getElementById('link-eixo-rodape-container').hidden = false;
    }
    if (moduloAtual.disciplina) {
      const urlDisc = `/disciplina.html?id=${moduloAtual.disciplina.id}`;
      document.getElementById('link-disciplina').href = urlDisc;
      document.getElementById('link-disciplina-rodape').href = urlDisc;
      document.getElementById('link-disciplina-container').hidden = false;
      document.getElementById('link-disciplina-rodape-container').hidden = false;
    }

    atualizarContagens();
    renderizarTemas();
    await carregarSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

function atualizarContagens() {
  let total = 0, concluidos = 0;
  moduloAtual.temas.forEach(t => {
    const mt = metricasTema(t);
    if (mt.total > 0) {
      total++;
      if (mt.todasConcluidas) concluidos++;
    }
  });
  document.querySelector('[data-contagem="todos"]').textContent = total;
  document.querySelector('[data-contagem="concluidos"]').textContent = concluidos;
  document.querySelector('[data-contagem="pendentes"]').textContent = total - concluidos;
}

function renderizarTemas() {
  const container = document.getElementById('temas');
  if (!moduloAtual || !moduloAtual.temas.length) {
    container.innerHTML = '<p class="vazio">Nenhum tema cadastrado ainda.</p>';
    return;
  }

  const filtrados = moduloAtual.temas.filter(t => {
    const mt = metricasTema(t);
    if (filtroAtual === 'concluidos') return mt.total > 0 && mt.todasConcluidas;
    if (filtroAtual === 'pendentes') return mt.total === 0 || !mt.todasConcluidas;
    return true;
  });

  if (!filtrados.length) {
    container.innerHTML = '<p class="vazio">Nada por aqui com esse filtro.</p>';
    return;
  }

  container.innerHTML = filtrados.map(tema => {
    const mt = metricasTema(tema);
    const textoAulas = mt.total === 0 ? 'Nenhuma aula ainda' : `${mt.concluidas}/${mt.total} aulas`;
    const classeConcluida = mt.todasConcluidas ? ' concluida' : '';

    return `
      <div class="cartao-eixo cartao-tema${classeConcluida}">
        <button class="botao-check" data-acao="toggle-concluida" data-id="${tema.id}" type="button"
                title="${mt.todasConcluidas ? 'Desmarcar tudo' : 'Marcar tudo como concluído'}">
          ${mt.todasConcluidas ? '✓' : ''}
        </button>
        <a class="cartao-link" href="/tema.html?id=${tema.id}">
          <span class="cartao-numero">Tema</span>
          <h3 class="cartao-titulo">${escapar(tema.titulo)}</h3>
          <span class="cartao-contagem">${textoAulas}</span>
        </a>
        <div class="cartao-acoes">
          <button class="botao-editar" data-acao="editar-tema" data-id="${tema.id}" type="button">Editar</button>
          <button class="botao-excluir" data-acao="excluir-tema" data-id="${tema.id}" type="button">Excluir</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="editar-tema"]').forEach(btn =>
    btn.addEventListener('click', abrirEditorEdicao));
  container.querySelectorAll('[data-acao="excluir-tema"]').forEach(btn =>
    btn.addEventListener('click', excluirTema));
  container.querySelectorAll('[data-acao="toggle-concluida"]').forEach(btn =>
    btn.addEventListener('click', toggleConcluida));
}

async function toggleConcluida(evento) {
  const id = evento.currentTarget.dataset.id;
  try {
    await api(`/temas/${id}/concluida`, { method: 'PATCH' });
    await carregarModulo();
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
  temaEditandoId = null;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Adicionar tema';
  document.getElementById('erro-editor').hidden = true;
  dialog.showModal();
}

function abrirEditorEdicao(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  const tema = moduloAtual.temas.find(t => t.id === id);
  if (!tema) return;
  temaEditandoId = id;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Editar tema';
  document.getElementById('erro-editor').hidden = true;
  form.titulo.value = tema.titulo || '';
  form.descricao.value = tema.descricao || '';
  dialog.showModal();
}

async function salvarEditor(evento) {
  evento.preventDefault();
  if (!moduloAtual) return;
  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    descricao: form.descricao?.value.trim() || null
  };
  try {
    if (temaEditandoId) {
      await api(`/temas/${temaEditandoId}`, { method: 'PUT', body: dados });
      mostrarMensagem('Tema atualizado 🌸');
    } else {
      dados.modulo_id = moduloAtual.id;
      await api('/temas', { method: 'POST', body: dados });
      mostrarMensagem('Tema criado 🌸');
    }
    document.getElementById('dialogo-editor').close();
    temaEditandoId = null;
    await carregarModulo();
  } catch (e) {
    document.getElementById('erro-editor').textContent = e.message;
    document.getElementById('erro-editor').hidden = false;
  }
}

async function excluirTema(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir esse tema? Apaga as aulas dentro. Não tem volta.')) return;
  try {
    await api(`/temas/${id}`, { method: 'DELETE' });
    mostrarMensagem('Tema excluído.');
    await carregarModulo();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

async function excluirModulo() {
  if (!moduloAtual) return;
  if (!confirm('Excluir esse módulo? Apaga temas e aulas dentro. Não tem volta.')) return;
  try {
    await api(`/modulos/${moduloAtual.id}`, { method: 'DELETE' });
    mostrarMensagem('Módulo excluído. Voltando...');
    setTimeout(() => {
      if (moduloAtual.disciplina) {
        location.href = `/disciplina.html?id=${moduloAtual.disciplina.id}`;
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
  await carregarModulo();
  configurarBusca();

  document.querySelectorAll('.filtro-capsula').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-capsula').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderizarTemas();
    });
  });

  document.getElementById('btn-add-tema').addEventListener('click', abrirEditorNova);
  document.getElementById('btn-excluir-modulo').addEventListener('click', excluirModulo);

  document.getElementById('form-editor').addEventListener('submit', salvarEditor);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
    temaEditandoId = null;
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