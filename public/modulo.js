// ===================================================
// MODULO.JS — Página de um módulo
// ===================================================

const API = '/api';

let moduloAtual = null;
let ementaAtual = [];
let estaLogada = false;
let temaEditandoId = null;
let timeoutBusca = null;

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

    renderizarTemas();
    await carregarSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

function renderizarTemas() {
  const container = document.getElementById('temas');
  if (!moduloAtual || !moduloAtual.temas.length) {
    container.innerHTML = '<p class="vazio">Nenhum tema cadastrado ainda.</p>';
    return;
  }

  container.innerHTML = moduloAtual.temas.map(tema => {
    const total = tema.aulas.length;
    const concluidas = tema.aulas.filter(a => a.concluida).length;

    const textoAulas = total === 0
      ? 'Nenhuma aula ainda'
      : `${concluidas}/${total} aulas`;

    return `
      <div class="cartao-eixo cartao-tema">
        <a class="cartao-link" href="/tema.html?id=${tema.id}">
          <span class="cartao-numero">Tema</span>
          <h3 class="cartao-titulo">${escapar(tema.titulo)}</h3>
          <span class="cartao-contagem">${textoAulas}</span>
        </a>
        ${estaLogada ? `
          <div class="cartao-acoes">
            <button class="botao-editar" data-acao="editar-tema" data-id="${tema.id}" type="button">Editar</button>
            <button class="botao-excluir" data-acao="excluir-tema" data-id="${tema.id}" type="button">Excluir</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="editar-tema"]').forEach(btn =>
    btn.addEventListener('click', abrirEditorEdicao));
  container.querySelectorAll('[data-acao="excluir-tema"]').forEach(btn =>
    btn.addEventListener('click', excluirTema));
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

async function verificarSessao() {
  try {
    const r = await api('/sessao');
    estaLogada = r.logada;
    document.getElementById('abrir-login').hidden = estaLogada;
    document.getElementById('sair').hidden = !estaLogada;
    document.getElementById('aviso-edicao').hidden = !estaLogada;
    document.getElementById('acoes-modulo').hidden = !estaLogada;
    if (moduloAtual) renderizarTemas();
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

// ---------- BUSCA ----------
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

// ===================================================
// BOTÕES FLUTUANTES
// ===================================================
(function ativarBotoesFlutuantes() {
  function atualizarVisibilidade() {
    const container = document.querySelector('.botoes-flutuantes');
    if (!container) return;
    const altura = document.documentElement.scrollHeight;
    const janela = window.innerHeight;
    if (altura > janela + 200) container.classList.add('visivel');
    else container.classList.remove('visivel');
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
  await carregarModulo();
  configurarBusca();

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
      await carregarModulo();
      mostrarMensagem('Bem-vinda de volta 🌿');
    } catch (err) {
      const el = document.getElementById('erro-login');
      el.textContent = err.message;
      el.hidden = false;
    }
  });

  document.getElementById('sair').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    estaLogada = false;
    await verificarSessao();
    await carregarModulo();
    mostrarMensagem('Sessão encerrada.');
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