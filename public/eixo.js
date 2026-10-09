// ===================================================
// EIXO.JS — Página individual de um eixo
// Cards de disciplina + editar/excluir quando logada
// ===================================================

const API = '/api';

let ementaAtual = [];
let eixoAtual = null;
let estaLogada = false;
let disciplinaEditandoId = null;

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

function pegarNumeroDoEixo() {
  const params = new URLSearchParams(location.search);
  const num = Number(params.get('numero'));
  return Number.isInteger(num) && num >= 1 && num <= 9 ? num : null;
}

// ---------- CARREGAR ----------
async function carregarEixo() {
  const numero = pegarNumeroDoEixo();
  const container = document.getElementById('disciplinas');

  if (!numero) {
    document.getElementById('titulo-eixo').textContent = 'Eixo não encontrado';
    container.innerHTML = '<p class="erro">Número de eixo inválido na URL.</p>';
    return;
  }

  try {
    ementaAtual = await api('/ementa');
    eixoAtual = ementaAtual.find(e => e.numero === numero) || null;

    if (!eixoAtual) {
      document.getElementById('titulo-eixo').textContent = 'Eixo não encontrado';
      container.innerHTML = '<p class="erro">Esse eixo não existe.</p>';
      return;
    }

    document.title = `Eixo ${eixoAtual.numero} — ${eixoAtual.titulo}`;
    document.getElementById('titulo-eixo').textContent =
      `Eixo ${eixoAtual.numero} — ${eixoAtual.titulo}`;

    renderizarDisciplinas();
    preencherSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// ---------- RENDERIZAR DISCIPLINAS ----------
function renderizarDisciplinas() {
  const container = document.getElementById('disciplinas');
  if (!eixoAtual || !eixoAtual.disciplinas.length) {
    container.innerHTML = '<p class="vazio">Nenhuma disciplina cadastrada nesse eixo ainda.</p>';
    return;
  }

  container.innerHTML = eixoAtual.disciplinas.map(disc => {
    let total = 0;
    let concluidas = 0;
    disc.modulos.forEach(m => {
      m.temas.forEach(t => {
        t.aulas.forEach(a => {
          total++;
          if (a.concluida) concluidas++;
        });
      });
    });

    const textoAulas = total === 0
      ? 'Nenhuma aula ainda'
      : `${concluidas}/${total} aulas`;

    return `
      <div class="cartao-eixo cartao-disciplina">
        <a class="cartao-link" href="/disciplina.html?id=${disc.id}">
          <span class="cartao-numero">Disciplina</span>
          <h3 class="cartao-titulo">${escapar(disc.titulo)}</h3>
          <span class="cartao-contagem">${textoAulas}</span>
        </a>
        ${estaLogada ? `
          <div class="cartao-acoes">
            <button class="botao-editar" data-acao="editar-disciplina" data-id="${disc.id}" type="button">Editar</button>
            <button class="botao-excluir" data-acao="excluir-disciplina" data-id="${disc.id}" type="button">Excluir</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="editar-disciplina"]').forEach(btn => {
    btn.addEventListener('click', abrirEditorEdicao);
  });
  container.querySelectorAll('[data-acao="excluir-disciplina"]').forEach(btn => {
    btn.addEventListener('click', excluirDisciplina);
  });
}

// ---------- SUBMENU ----------
function preencherSubmenuEixos() {
  const submenu = document.getElementById('submenu-eixos');
  if (!submenu) return;
  submenu.innerHTML = ementaAtual.map(e => `
    <li>
      <a href="/eixo.html?numero=${e.numero}">
        Eixo ${e.numero} — ${escapar(e.titulo)}
      </a>
    </li>
  `).join('');
}

// ---------- LOGIN ----------
async function verificarSessao() {
  try {
    const r = await api('/sessao');
    estaLogada = r.logada;
    document.getElementById('abrir-login').hidden = estaLogada;
    document.getElementById('sair').hidden = !estaLogada;
    document.getElementById('aviso-edicao').hidden = !estaLogada;
    const btn = document.getElementById('btn-add-disciplina');
    if (btn) btn.hidden = !estaLogada;
    if (eixoAtual) renderizarDisciplinas();
  } catch {}
}

// ---------- ADICIONAR ----------
function abrirEditorNova() {
  disciplinaEditandoId = null;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Adicionar disciplina';
  document.getElementById('erro-editor').hidden = true;
  dialog.showModal();
}

// ---------- EDITAR ----------
function abrirEditorEdicao(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  const disc = eixoAtual.disciplinas.find(d => d.id === id);
  if (!disc) return;

  disciplinaEditandoId = id;
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('titulo-editor').textContent = 'Editar disciplina';
  document.getElementById('erro-editor').hidden = true;

  form.titulo.value = disc.titulo || '';
  form.descricao.value = disc.descricao || '';
  form.ordem.value = disc.ordem || 0;

  dialog.showModal();
}

async function salvarEditor(evento) {
  evento.preventDefault();
  if (!eixoAtual) return;

  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    descricao: form.descricao?.value.trim() || null,
    ordem: Number(form.ordem.value) || 0
  };

  try {
    if (disciplinaEditandoId) {
      await api(`/disciplinas/${disciplinaEditandoId}`, { method: 'PUT', body: dados });
      mostrarMensagem('Disciplina atualizada 🌸');
    } else {
      dados.eixo_id = eixoAtual.id;
      await api('/disciplinas', { method: 'POST', body: dados });
      mostrarMensagem('Disciplina criada 🌸');
    }
    document.getElementById('dialogo-editor').close();
    disciplinaEditandoId = null;
    await carregarEixo();
  } catch (e) {
    document.getElementById('erro-editor').textContent = e.message;
    document.getElementById('erro-editor').hidden = false;
  }
}

// ---------- EXCLUIR ----------
async function excluirDisciplina(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir essa disciplina? Apaga módulos, temas e aulas dentro. Não tem volta.')) return;
  try {
    await api(`/disciplinas/${id}`, { method: 'DELETE' });
    mostrarMensagem('Disciplina excluída.');
    await carregarEixo();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

// ===================================================
// BOTÕES FLUTUANTES
// ===================================================
(function ativarBotoesFlutuantes() {
  function atualizarVisibilidade() {
    const container = document.querySelector('.botoes-flutuantes');
    if (!container) return;
    const altura = document.documentElement.scrollHeight;
    const janela = window.innerHeight;
    if (altura > janela + 200) {
      container.classList.add('visivel');
    } else {
      container.classList.remove('visivel');
    }
  }

  function iniciar() {
    const btnTopo = document.getElementById('ir-topo');
    const btnFundo = document.getElementById('ir-fundo');
    if (btnTopo) btnTopo.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    if (btnFundo) btnFundo.onclick = () => window.scrollTo({
      top: document.documentElement.scrollHeight, behavior: 'smooth'
    });

    window.addEventListener('scroll', atualizarVisibilidade);
    window.addEventListener('resize', atualizarVisibilidade);
    if (window.ResizeObserver) new ResizeObserver(atualizarVisibilidade).observe(document.body);
    document.addEventListener('toggle', atualizarVisibilidade, true);

    atualizarVisibilidade();
    [100, 300, 600, 1000, 2000, 3000].forEach(ms => setTimeout(atualizarVisibilidade, ms));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

// ===================================================
// EVENTOS INICIAIS
// ===================================================
document.addEventListener('DOMContentLoaded', async () => {
  await verificarSessao();
  await carregarEixo();

  // --- Login ---
  const dlgLogin = document.getElementById('dialogo-login');
  document.getElementById('abrir-login').addEventListener('click', () => dlgLogin.showModal());
  document.getElementById('cancelar-login').addEventListener('click', () => dlgLogin.close());
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const senha = document.getElementById('senha').value;
    try {
      await api('/login', { method: 'POST', body: { senha } });
      estaLogada = true;
      await verificarSessao();
      dlgLogin.close();
      mostrarMensagem('Bem-vinda de volta 🌿');
    } catch (err) {
      const el = document.getElementById('erro-login');
      el.textContent = err.message;
      el.hidden = false;
    }
  });

  // --- Logout ---
  document.getElementById('sair').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    estaLogada = false;
    await verificarSessao();
    mostrarMensagem('Sessão encerrada.');
  });

  // --- Adicionar ---
  const btnAdd = document.getElementById('btn-add-disciplina');
  if (btnAdd) btnAdd.addEventListener('click', abrirEditorNova);

  // --- Editor ---
  document.getElementById('form-editor').addEventListener('submit', salvarEditor);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
    disciplinaEditandoId = null;
  });

  // --- Menu suspenso ---
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

  // --- Backup ---
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