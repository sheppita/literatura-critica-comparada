// ===================================================
// APP.JS — Cérebro do frontend
// Conversa com a API em /api/* e monta a interface
// ===================================================

const API = '/api';

// ---------- ESTADO GLOBAL ----------
let ementaAtual = [];
let estaLogada = false;

// ---------- HELPERS ----------
async function api(caminho, opcoes = {}) {
  const resp = await fetch(API + caminho, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
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

// ---------- CARREGAR EMENTA ----------
async function carregarEmenta() {
  const container = document.getElementById('eixos');
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<p>Carregando a ementa…</p>';

  try {
    ementaAtual = await api('/ementa');
    renderizarEmenta();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// ---------- RENDERIZAR ÁRVORE ----------
function renderizarEmenta() {
  const container = document.getElementById('eixos');
  if (!ementaAtual.length) {
    container.innerHTML = '<p class="vazio">Nenhum eixo cadastrado ainda.</p>';
    return;
  }

  container.innerHTML = ementaAtual.map(eixo => `
    <details class="eixo">
      <summary>Eixo ${eixo.numero} — ${escapar(eixo.titulo)}</summary>
      <div class="corpo-eixo">
        ${renderizarDisciplinas(eixo)}
        ${estaLogada ? botaoAdicionar('disciplina', eixo.id, 'Adicionar disciplina') : ''}
      </div>
    </details>
  `).join('');

  // Ligar eventos de "adicionar"
  container.querySelectorAll('[data-acao="adicionar"]').forEach(btn => {
    btn.addEventListener('click', abrirEditor);
  });
  container.querySelectorAll('[data-acao="excluir"]').forEach(btn => {
    btn.addEventListener('click', excluirItem);
  });
}

function renderizarDisciplinas(eixo) {
  if (!eixo.disciplinas.length) {
    return '<p class="vazio">Nenhuma disciplina ainda.</p>';
  }
  return eixo.disciplinas.map(disc => `
    <details class="modulo">
      <summary>${escapar(disc.titulo)}</summary>
      <div class="corpo-item">
        ${disc.descricao ? `<p class="texto-conteudo">${escapar(disc.descricao)}</p>` : ''}
        ${renderizarModulos(disc)}
        ${estaLogada ? botaoAdicionar('modulo', disc.id, 'Adicionar módulo') : ''}
        ${estaLogada ? botaoExcluir('disciplinas', disc.id) : ''}
      </div>
    </details>
  `).join('');
}

function renderizarModulos(disc) {
  if (!disc.modulos.length) return '';
  return disc.modulos.map(mod => `
    <details class="submodulo">
      <summary>${escapar(mod.titulo)}</summary>
      <div class="corpo-item">
        ${mod.descricao ? `<p class="texto-conteudo">${escapar(mod.descricao)}</p>` : ''}
        ${renderizarTemas(mod)}
        ${estaLogada ? botaoAdicionar('tema', mod.id, 'Adicionar tema') : ''}
        ${estaLogada ? botaoExcluir('modulos', mod.id) : ''}
      </div>
    </details>
  `).join('');
}

function renderizarTemas(mod) {
  if (!mod.temas.length) return '';
  return mod.temas.map(tema => `
    <details class="tema">
      <summary>${escapar(tema.titulo)}</summary>
      <div class="corpo-item">
        ${tema.descricao ? `<p class="texto-conteudo">${escapar(tema.descricao)}</p>` : ''}
        ${renderizarAulas(tema)}
        ${estaLogada ? botaoAdicionar('aula', tema.id, 'Adicionar aula') : ''}
        ${estaLogada ? botaoExcluir('temas', tema.id) : ''}
      </div>
    </details>
  `).join('');
}

function renderizarAulas(tema) {
  if (!tema.aulas.length) return '';
  return tema.aulas.map(aula => `
    <article class="tema">
      <div class="corpo-item">
        <strong>${escapar(aula.titulo)}</strong>
        ${aula.conteudo ? `<p class="texto-conteudo">${escapar(aula.conteudo)}</p>` : ''}
        ${aula.links ? `<p class="rotulo-conteudo">Links</p><p class="texto-conteudo">${escapar(aula.links)}</p>` : ''}
        ${estaLogada ? botaoExcluir('aulas', aula.id) : ''}
      </div>
    </article>
  `).join('');
}

function botaoAdicionar(tipo, paiId, rotulo) {
  return `<div class="acoes-item">
    <button data-acao="adicionar" data-tipo="${tipo}" data-pai="${paiId}">+ ${rotulo}</button>
  </div>`;
}

function botaoExcluir(recurso, id) {
  return `<div class="acoes-item">
    <button class="botao-excluir" data-acao="excluir" data-recurso="${recurso}" data-id="${id}">Excluir</button>
  </div>`;
}

// ---------- LOGIN ----------
async function verificarSessao() {
  try {
    const r = await api('/sessao');
    estaLogada = r.logada;
    atualizarCabecalho();
  } catch {}
}

function atualizarCabecalho() {
  document.getElementById('abrir-login').hidden = estaLogada;
  document.getElementById('sair').hidden = !estaLogada;
  document.getElementById('aviso-edicao').hidden = !estaLogada;
}

// ---------- EDITOR ----------
let contextoEditor = null;

function abrirEditor(evento) {
  const btn = evento.currentTarget;
  contextoEditor = { tipo: btn.dataset.tipo, pai: btn.dataset.pai };

  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();

  const titulos = {
    disciplina: 'Nova disciplina',
    modulo: 'Novo módulo',
    tema: 'Novo tema',
    aula: 'Nova aula'
  };
  document.getElementById('titulo-editor').textContent = titulos[contextoEditor.tipo] || 'Adicionar';

  // Mostra campos extras pra aula
  document.getElementById('campos-tema').hidden = contextoEditor.tipo !== 'aula';

  dialog.showModal();
}

async function salvarEditor(evento) {
  evento.preventDefault();
  if (!contextoEditor) return;

  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    descricao: form.descricao?.value.trim() || null,
    ordem: Number(form.ordem.value) || 0
  };

  const rotas = {
    disciplina: '/disciplinas',
    modulo: '/modulos',
    tema: '/temas',
    aula: '/aulas'
  };
  const chaves = {
    disciplina: 'eixo_id',
    modulo: 'disciplina_id',
    tema: 'modulo_id',
    aula: 'tema_id'
  };

  dados[chaves[contextoEditor.tipo]] = Number(contextoEditor.pai);

  if (contextoEditor.tipo === 'aula') {
    dados.conteudo = document.getElementById('campo-anotacoes')?.value.trim() || dados.descricao;
    dados.links = document.getElementById('campo-links')?.value.trim() || null;
  }

  try {
    await api(rotas[contextoEditor.tipo], { method: 'POST', body: dados });
    document.getElementById('dialogo-editor').close();
    mostrarMensagem('Salvo com sucesso 🌸');
    await carregarEmenta();
  } catch (e) {
    document.getElementById('erro-editor').textContent = e.message;
    document.getElementById('erro-editor').hidden = false;
  }
}

// ---------- EXCLUIR ----------
async function excluirItem(evento) {
  const btn = evento.currentTarget;
  const { recurso, id } = btn.dataset;
  if (!confirm('Tem certeza que quer excluir? Isso apaga tudo que está dentro também.')) return;

  try {
    await api(`/${recurso}/${id}`, { method: 'DELETE' });
    mostrarMensagem('Excluído.');
    await carregarEmenta();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

// ---------- EVENTOS INICIAIS ----------
document.addEventListener('DOMContentLoaded', async () => {
  await verificarSessao();
  await carregarEmenta();

  // Login
  const dlgLogin = document.getElementById('dialogo-login');
  document.getElementById('abrir-login').addEventListener('click', () => dlgLogin.showModal());
  document.getElementById('cancelar-login').addEventListener('click', () => dlgLogin.close());
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('senha').value;
    try {
      await api('/login', { method: 'POST', body: { senha } });
      estaLogada = true;
      atualizarCabecalho();
      dlgLogin.close();
      await carregarEmenta();
      mostrarMensagem('Bem-vinda de volta 🌿');
    } catch (err) {
      const el = document.getElementById('erro-login');
      el.textContent = err.message;
      el.hidden = false;
    }
  });

  // Logout
  document.getElementById('sair').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    estaLogada = false;
    atualizarCabecalho();
    await carregarEmenta();
  });

  // Editor
  document.getElementById('form-editor').addEventListener('submit', salvarEditor);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
  });
});