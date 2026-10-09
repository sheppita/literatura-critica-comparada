// ===================================================
// TEMA.JS — Página de um tema
// Lê ?id=N da URL e mostra as aulas como cards
// ===================================================

const API = '/api';

// ---------- ESTADO ----------
let temaAtual = null;
let ementaAtual = [];
let estaLogada = false;
let aulaEditandoId = null;
let filtroAtual = 'todas'; // 'todas' | 'pendentes' | 'concluidas'

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

function pegarId() {
  const params = new URLSearchParams(location.search);
  const id = Number(params.get('id'));
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ---------- CARREGAR TEMA ----------
async function carregarTema() {
  const id = pegarId();
  const container = document.getElementById('aulas');

  if (!id) {
    document.getElementById('titulo-tema').textContent = 'Tema não encontrado';
    container.innerHTML = '<p class="erro">ID inválido na URL.</p>';
    return;
  }

  try {
    temaAtual = await api(`/temas/${id}`);

    document.title = `${temaAtual.titulo} — Literatura Crítica e Comparada`;
    document.getElementById('titulo-tema').textContent = temaAtual.titulo;

    if (temaAtual.eixo) {
      document.getElementById('breadcrumb-eixo').textContent =
        `Eixo ${temaAtual.eixo.numero} — ${temaAtual.eixo.titulo}`;
    } else {
      document.getElementById('breadcrumb-eixo').textContent = 'Tema';
    }

    if (temaAtual.eixo) {
      const url = `/eixo.html?numero=${temaAtual.eixo.numero}`;
      document.getElementById('link-eixo').href = url;
      document.getElementById('link-eixo-rodape').href = url;
      document.getElementById('link-eixo-container').hidden = false;
      document.getElementById('link-eixo-rodape-container').hidden = false;
    }
    if (temaAtual.disciplina) {
      const url = `/disciplina.html?id=${temaAtual.disciplina.id}`;
      document.getElementById('link-disciplina').href = url;
      document.getElementById('link-disciplina-rodape').href = url;
      document.getElementById('link-disciplina-container').hidden = false;
      document.getElementById('link-disciplina-rodape-container').hidden = false;
    }
    if (temaAtual.modulo) {
      const url = `/modulo.html?id=${temaAtual.modulo.id}`;
      document.getElementById('link-modulo').href = url;
      document.getElementById('link-modulo-rodape').href = url;
      document.getElementById('link-modulo-container').hidden = false;
      document.getElementById('link-modulo-rodape-container').hidden = false;
    }

    atualizarContagens();
    renderizarAulas();
    await carregarSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// ---------- ATUALIZAR CONTAGENS DO FILTRO ----------
function atualizarContagens() {
  const total = temaAtual.aulas.length;
  const concluidas = temaAtual.aulas.filter(a => a.concluida).length;
  const pendentes = total - concluidas;

  const filtrosEl = document.getElementById('filtros-aulas');
  if (filtrosEl) filtrosEl.hidden = total === 0;

  document.querySelector('[data-contagem="todas"]').textContent = total;
  document.querySelector('[data-contagem="pendentes"]').textContent = pendentes;
  document.querySelector('[data-contagem="concluidas"]').textContent = concluidas;
}

// ---------- RENDERIZAR AULAS ----------
function renderizarAulas() {
  const container = document.getElementById('aulas');
  if (!temaAtual || !temaAtual.aulas.length) {
    container.innerHTML = '<p class="vazio">Nenhuma aula cadastrada ainda.</p>';
    return;
  }

  const aulasFiltradas = temaAtual.aulas.filter(aula => {
    if (filtroAtual === 'pendentes') return !aula.concluida;
    if (filtroAtual === 'concluidas') return aula.concluida;
    return true;
  });

  if (!aulasFiltradas.length) {
    const mensagens = {
      pendentes: 'Nenhuma aula pendente. Tudo em dia! 🌿',
      concluidas: 'Nenhuma aula concluída ainda.'
    };
    container.innerHTML = `<p class="vazio">${mensagens[filtroAtual] || 'Nada aqui.'}</p>`;
    return;
  }

  container.innerHTML = aulasFiltradas.map(aula => {
    const linksCount = (aula.links || '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean).length;

    const textoLinks = linksCount === 0
      ? 'Sem links'
      : linksCount === 1
        ? '1 link'
        : `${linksCount} links`;

    const preview = aula.conteudo
      ? escapar(aula.conteudo).slice(0, 140) + (aula.conteudo.length > 140 ? '…' : '')
      : '';

    const classeConcluida = aula.concluida ? ' concluida' : '';

    return `
      <div class="cartao-eixo cartao-aula${classeConcluida}">
        ${estaLogada ? `
          <button class="botao-check" data-acao="toggle-concluida" data-id="${aula.id}" type="button"
                  title="${aula.concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}"
                  aria-label="${aula.concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}">
            ${aula.concluida ? '✓' : ''}
          </button>
        ` : (aula.concluida ? '<span class="check-visivel" aria-hidden="true">✓</span>' : '')}
        <span class="cartao-numero">Aula</span>
        <h3 class="cartao-titulo">${escapar(aula.titulo)}</h3>
        ${preview ? `<p class="cartao-preview">${preview}</p>` : ''}
        <span class="cartao-contagem">${textoLinks}</span>
        ${estaLogada ? `
          <div class="cartao-acoes">
            <button data-acao="editar-aula" data-id="${aula.id}" type="button">Editar</button>
            <button class="botao-excluir" data-acao="excluir-aula" data-id="${aula.id}" type="button">Excluir</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Eventos
  container.querySelectorAll('[data-acao="editar-aula"]').forEach(btn => {
    btn.addEventListener('click', abrirEditorEdicao);
  });
  container.querySelectorAll('[data-acao="excluir-aula"]').forEach(btn => {
    btn.addEventListener('click', excluirAula);
  });
  container.querySelectorAll('[data-acao="toggle-concluida"]').forEach(btn => {
    btn.addEventListener('click', toggleConcluida);
  });
}

// ---------- TOGGLE CONCLUÍDA ----------
async function toggleConcluida(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  try {
    await api(`/aulas/${id}/concluida`, { method: 'PATCH' });
    await carregarTema();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

// ---------- SUBMENU ----------
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

// ---------- LOGIN ----------
async function verificarSessao() {
  try {
    const r = await api('/sessao');
    estaLogada = r.logada;
    document.getElementById('abrir-login').hidden = estaLogada;
    document.getElementById('sair').hidden = !estaLogada;
    document.getElementById('aviso-edicao').hidden = !estaLogada;
    document.getElementById('acoes-tema').hidden = !estaLogada;
  } catch {}
}

// ---------- ADICIONAR AULA ----------
function abrirEditorNova() {
  const dialog = document.getElementById('dialogo-editor');
  const form = document.getElementById('form-editor');
  form.reset();
  document.getElementById('erro-editor').hidden = true;
  dialog.showModal();
}

async function salvarNovaAula(evento) {
  evento.preventDefault();
  if (!temaAtual) return;

  const form = evento.target;
  const dados = {
    tema_id: temaAtual.id,
    titulo: form.titulo.value.trim(),
    conteudo: form.anotacoes?.value.trim() || null,
    links: form.links?.value.trim() || null,
    ordem: Number(form.ordem.value) || 0
  };

  try {
    await api('/aulas', { method: 'POST', body: dados });
    document.getElementById('dialogo-editor').close();
    mostrarMensagem('Aula adicionada 🌸');
    await carregarTema();
  } catch (e) {
    document.getElementById('erro-editor').textContent = e.message;
    document.getElementById('erro-editor').hidden = false;
  }
}

// ---------- EDITAR AULA ----------
function abrirEditorEdicao(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  const aula = temaAtual.aulas.find(a => a.id === id);
  if (!aula) return;

  aulaEditandoId = id;

  const dialog = document.getElementById('dialogo-editar-aula');
  const form = document.getElementById('form-editar-aula');
  form.reset();
  document.getElementById('erro-editar-aula').hidden = true;

  form.titulo.value = aula.titulo || '';
  form.anotacoes.value = aula.conteudo || '';
  form.links.value = aula.links || '';

  dialog.showModal();
}

async function salvarEdicaoAula(evento) {
  evento.preventDefault();
  if (!aulaEditandoId) return;

  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    conteudo: form.anotacoes?.value.trim() || null,
    links: form.links?.value.trim() || null
  };

  try {
    await api(`/aulas/${aulaEditandoId}`, { method: 'PUT', body: dados });
    document.getElementById('dialogo-editar-aula').close();
    mostrarMensagem('Aula atualizada 🌸');
    aulaEditandoId = null;
    await carregarTema();
  } catch (e) {
    document.getElementById('erro-editar-aula').textContent = e.message;
    document.getElementById('erro-editar-aula').hidden = false;
  }
}

// ---------- EXCLUIR ----------
async function excluirAula(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir essa aula? Não tem volta.')) return;

  try {
    await api(`/aulas/${id}`, { method: 'DELETE' });
    mostrarMensagem('Aula excluída.');
    await carregarTema();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

async function excluirTema() {
  if (!temaAtual) return;
  if (!confirm('Excluir esse tema? Isso apaga todas as aulas dentro dele. Não tem volta.')) return;

  try {
    await api(`/temas/${temaAtual.id}`, { method: 'DELETE' });
    mostrarMensagem('Tema excluído. Voltando...');
    setTimeout(() => {
      if (temaAtual.modulo) {
        location.href = `/modulo.html?id=${temaAtual.modulo.id}`;
      } else {
        location.href = '/';
      }
    }, 1200);
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
  await carregarTema();

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
      await carregarTema();
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
    await carregarTema();
    mostrarMensagem('Sessão encerrada.');
  });

  // --- Adicionar / excluir tema ---
  document.getElementById('btn-add-aula').addEventListener('click', abrirEditorNova);
  document.getElementById('btn-excluir-tema').addEventListener('click', excluirTema);

  // --- Editor (adicionar) ---
  document.getElementById('form-editor').addEventListener('submit', salvarNovaAula);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
  });

  // --- Editor (editar) ---
  document.getElementById('form-editar-aula').addEventListener('submit', salvarEdicaoAula);
  document.getElementById('cancelar-editar-aula').addEventListener('click', () => {
    document.getElementById('dialogo-editar-aula').close();
    aulaEditandoId = null;
  });

  // --- Filtros de aula ---
  document.querySelectorAll('.filtro-capsula').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-capsula').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderizarAulas();
    });
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