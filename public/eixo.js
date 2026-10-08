// ===================================================
// EIXO.JS — Página individual de um eixo
// Lê ?numero=N da URL e mostra só aquele eixo
// ===================================================

const API = '/api';

// ---------- ESTADO ----------
let ementaAtual = [];
let eixoAtual = null;
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

// ---------- PEGAR O NÚMERO DO EIXO DA URL ----------
function pegarNumeroDoEixo() {
  const params = new URLSearchParams(location.search);
  const num = Number(params.get('numero'));
  return Number.isInteger(num) && num >= 1 && num <= 9 ? num : null;
}

// ---------- CARREGAR EMENTA E FILTRAR ----------
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

  container.innerHTML = eixoAtual.disciplinas.map(disc => `
    <details class="modulo" open>
      <summary>${escapar(disc.titulo)}</summary>
      <div class="corpo-item">
        ${disc.descricao ? `<p class="texto-conteudo">${escapar(disc.descricao)}</p>` : ''}
        ${renderizarModulos(disc)}
        ${estaLogada ? botaoAdicionar('modulo', disc.id, 'Adicionar módulo') : ''}
        ${estaLogada ? botaoExcluir('disciplinas', disc.id) : ''}
      </div>
    </details>
  `).join('');

  // Re-ligar eventos de adicionar/excluir
  container.querySelectorAll('[data-acao="adicionar"]').forEach(btn => {
    btn.addEventListener('click', abrirEditor);
  });
  container.querySelectorAll('[data-acao="excluir"]').forEach(btn => {
    btn.addEventListener('click', excluirItem);
  });
}

function renderizarModulos(disc) {
  if (!disc.modulos.length) return '';
  return disc.modulos.map(mod => `
    <details class="submodulo" open>
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
    document.getElementById('abrir-login').hidden = estaLogada;
    document.getElementById('sair').hidden = !estaLogada;
    document.getElementById('aviso-edicao').hidden = !estaLogada;
  } catch {}
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
    await carregarEixo();
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
    await carregarEixo();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

// ---------- SUBMENU DE EIXOS ----------
function preencherSubmenuEixos() {
  const submenu = document.getElementById('submenu-eixos');
  if (!submenu) return;
  if (!ementaAtual.length) {
    submenu.innerHTML = '<li><a href="#">Nenhum eixo ainda</a></li>';
    return;
  }
  submenu.innerHTML = ementaAtual.map(e => `
    <li>
      <a href="/eixo.html?numero=${e.numero}">
        Eixo ${e.numero} — ${escapar(e.titulo)}
      </a>
    </li>
  `).join('');
}

// ===================================================
// BOTÕES FLUTUANTES — auto-inicialização
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

    if (btnTopo) {
      btnTopo.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (btnFundo) {
      btnFundo.onclick = () => window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }

    window.addEventListener('scroll', atualizarVisibilidade);
    window.addEventListener('resize', atualizarVisibilidade);

    if (window.ResizeObserver) {
      new ResizeObserver(atualizarVisibilidade).observe(document.body);
    }
    document.addEventListener('toggle', atualizarVisibilidade, true);

    atualizarVisibilidade();
    [100, 300, 600, 1000, 2000, 3000].forEach(ms =>
      setTimeout(atualizarVisibilidade, ms)
    );
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
      await carregarEixo();
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
    await carregarEixo();
  });

  // --- Editor ---
  document.getElementById('form-editor').addEventListener('submit', salvarEditor);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
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

  // --- Botão de backup ---
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