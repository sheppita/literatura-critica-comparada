// ===================================================
// TEMA.JS — Página de um tema
// ===================================================

const API = '/api';

let temaAtual = null;
let ementaAtual = [];
let estaLogada = false;
let aulaEditandoId = null;
let aulaAtualLivros = null;
let livroEditandoId = null;
let filtroAtual = 'todas';
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

  // Concluídas vão pro final (mas mantêm a ordem relativa)
  aulasFiltradas.sort((a, b) => {
    if (a.concluida === b.concluida) return 0;
    return a.concluida ? 1 : -1;
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
    const preview = aula.conteudo ? escapar(aula.conteudo) : '';

    const classeConcluida = aula.concluida ? ' concluida' : '';

    return `
      <div class="cartao-eixo cartao-aula${classeConcluida}">
        ${estaLogada ? `
          <button class="botao-check" data-acao="toggle-concluida" data-id="${aula.id}" type="button"
                  title="${aula.concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}">
            ${aula.concluida ? '✓' : ''}
          </button>
        ` : (aula.concluida ? '<span class="check-visivel" aria-hidden="true">✓</span>' : '')}

        <span class="cartao-numero">Aula</span>
        <h3 class="cartao-titulo">${escapar(aula.titulo)}</h3>
        ${preview ? `<p class="cartao-preview">${preview}</p>` : ''}

        ${renderizarLivrosDaAula(aula)}

        ${estaLogada ? `
          <div class="cartao-acoes">
            <button data-acao="editar-aula" data-id="${aula.id}" type="button">Editar</button>
            <button class="botao-excluir" data-acao="excluir-aula" data-id="${aula.id}" type="button">Excluir</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="editar-aula"]').forEach(btn =>
    btn.addEventListener('click', abrirEditorEdicao));
  container.querySelectorAll('[data-acao="excluir-aula"]').forEach(btn =>
    btn.addEventListener('click', excluirAula));
  container.querySelectorAll('[data-acao="toggle-concluida"]').forEach(btn =>
    btn.addEventListener('click', toggleConcluida));
  container.querySelectorAll('[data-acao="add-livro"]').forEach(btn =>
    btn.addEventListener('click', abrirEditorLivro));
  container.querySelectorAll('[data-acao="editar-livro"]').forEach(btn =>
    btn.addEventListener('click', editarLivro));
  container.querySelectorAll('[data-acao="excluir-livro"]').forEach(btn =>
    btn.addEventListener('click', excluirLivro));
}

function renderizarLivrosDaAula(aula) {
  const livros = aula.livros || [];
  if (!livros.length && !estaLogada) return '';

  const itens = livros.map(l => {
    const classeTipo = l.tipo === 'ancora' ? 'livro-ancora' : 'livro-base';
    const rotuloTipo = l.tipo === 'ancora' ? 'Âncora' : 'Texto-base';
    const cap = l.capitulo ? ` — Cap. ${escapar(l.capitulo)}` : '';
    const descCap = l.descricao_capitulo
      ? `<span class="livro-descricao">${escapar(l.descricao_capitulo)}</span>` : '';

    return `
      <li class="livro-item ${classeTipo}">
        <span class="livro-tipo-badge">${rotuloTipo}</span>
        <span class="livro-info">
          <strong>${escapar(l.titulo)}</strong>${l.autor ? ` — ${escapar(l.autor)}` : ''}${cap}
          ${descCap}
        </span>
        ${estaLogada ? `
          <span class="livro-acoes">
            <button data-acao="editar-livro" data-id="${l.id}" type="button" title="Editar">✎</button>
            <button data-acao="excluir-livro" data-id="${l.id}" type="button" title="Excluir" class="botao-excluir">✕</button>
          </span>
        ` : ''}
      </li>
    `;
  }).join('');

  return `
    <div class="bibliografia-aula">
      <p class="rotulo-conteudo">Bibliografia</p>
      <ul class="lista-livros">
        ${itens || '<li class="vazio">Nenhum livro cadastrado ainda.</li>'}
      </ul>
      ${estaLogada ? `
        <button class="botao-add-livro" data-acao="add-livro" data-id="${aula.id}" type="button">
          + Adicionar livro
        </button>
      ` : ''}
    </div>
  `;
}

async function toggleConcluida(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  try {
    await api(`/aulas/${id}/concluida`, { method: 'PATCH' });
    await carregarTema();
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

async function verificarSessao() {
  try {
    const r = await api('/sessao');
    estaLogada = r.logada;
    document.getElementById('abrir-login').hidden = estaLogada;
    document.getElementById('sair').hidden = !estaLogada;
    document.getElementById('aviso-edicao').hidden = !estaLogada;
    document.getElementById('acoes-tema').hidden = !estaLogada;
    if (temaAtual) renderizarAulas();
  } catch {}
}

// ---------- AULA ----------
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
    conteudo: form.anotacoes?.value.trim() || null
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

  dialog.showModal();
}

async function salvarEdicaoAula(evento) {
  evento.preventDefault();
  if (!aulaEditandoId) return;

  const form = evento.target;
  const dados = {
    titulo: form.titulo.value.trim(),
    conteudo: form.anotacoes?.value.trim() || null
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

async function excluirAula(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir essa aula? Apaga também os livros vinculados. Não tem volta.')) return;

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
  if (!confirm('Excluir esse tema? Apaga aulas e livros dentro. Não tem volta.')) return;

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

// ---------- LIVRO ----------
function abrirEditorLivro(evento) {
  aulaAtualLivros = Number(evento.currentTarget.dataset.id);
  livroEditandoId = null;

  const dialog = document.getElementById('dialogo-livro');
  const form = document.getElementById('form-livro');
  form.reset();
  document.getElementById('titulo-livro').textContent = 'Adicionar livro';
  document.getElementById('erro-livro').hidden = true;
  dialog.showModal();
}

function editarLivro(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  let livro = null;
  for (const aula of temaAtual.aulas) {
    const l = (aula.livros || []).find(x => x.id === id);
    if (l) { livro = l; aulaAtualLivros = aula.id; break; }
  }
  if (!livro) return;

  livroEditandoId = id;
  const dialog = document.getElementById('dialogo-livro');
  const form = document.getElementById('form-livro');
  form.reset();
  document.getElementById('titulo-livro').textContent = 'Editar livro';
  document.getElementById('erro-livro').hidden = true;

  form.titulo.value = livro.titulo || '';
  form.autor.value = livro.autor || '';
  form.capitulo.value = livro.capitulo || '';
  form.descricao_capitulo.value = livro.descricao_capitulo || '';
  form.observacoes.value = livro.observacoes || '';
  const radio = form.querySelector(`input[name="tipo"][value="${livro.tipo}"]`);
  if (radio) radio.checked = true;

  dialog.showModal();
}

async function salvarLivro(evento) {
  evento.preventDefault();
  if (!aulaAtualLivros) return;

  const form = evento.target;
  const dados = {
    aula_id: aulaAtualLivros,
    titulo: form.titulo.value.trim(),
    autor: form.autor?.value.trim() || null,
    capitulo: form.capitulo?.value.trim() || null,
    descricao_capitulo: form.descricao_capitulo?.value.trim() || null,
    tipo: form.querySelector('input[name="tipo"]:checked')?.value || 'texto-base',
    observacoes: form.observacoes?.value.trim() || null
  };

  try {
    if (livroEditandoId) {
      await api(`/livros/${livroEditandoId}`, { method: 'PUT', body: dados });
      mostrarMensagem('Livro atualizado 🌸');
    } else {
      await api('/livros', { method: 'POST', body: dados });
      mostrarMensagem('Livro adicionado 🌸');
    }
    document.getElementById('dialogo-livro').close();
    livroEditandoId = null;
    aulaAtualLivros = null;
    await carregarTema();
  } catch (e) {
    document.getElementById('erro-livro').textContent = e.message;
    document.getElementById('erro-livro').hidden = false;
  }
}

async function excluirLivro(evento) {
  const id = Number(evento.currentTarget.dataset.id);
  if (!confirm('Excluir esse livro?')) return;
  try {
    await api(`/livros/${id}`, { method: 'DELETE' });
    mostrarMensagem('Livro excluído.');
    await carregarTema();
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
// CABEÇALHO STICKY FINO
// ===================================================
(function ativarCabecalhoSticky() {
  function atualizar() {
    const barra = document.getElementById('cabecalho-sticky');
    if (!barra) return;

    const h1 = document.querySelector('.cabecalho h1, header h1');
    const alvo = document.getElementById('cabecalho-sticky-titulo');
    if (h1 && alvo) {
      alvo.textContent = h1.textContent;
    }

    if (window.scrollY > 180) {
      barra.classList.add('visivel');
    } else {
      barra.classList.remove('visivel');
    }
  }

  function iniciar() {
    window.addEventListener('scroll', atualizar, { passive: true });
    window.addEventListener('resize', atualizar);
    [100, 300, 600, 1000, 2000].forEach(ms => setTimeout(atualizar, ms));
    atualizar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();

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
  await carregarTema();
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
      await carregarTema();
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
    await carregarTema();
    mostrarMensagem('Sessão encerrada.');
  });

  document.getElementById('btn-add-aula').addEventListener('click', abrirEditorNova);
  document.getElementById('btn-excluir-tema').addEventListener('click', excluirTema);

  document.getElementById('form-editor').addEventListener('submit', salvarNovaAula);
  document.getElementById('cancelar-editor').addEventListener('click', () => {
    document.getElementById('dialogo-editor').close();
  });

  document.getElementById('form-editar-aula').addEventListener('submit', salvarEdicaoAula);
  document.getElementById('cancelar-editar-aula').addEventListener('click', () => {
    document.getElementById('dialogo-editar-aula').close();
    aulaEditandoId = null;
  });

  document.getElementById('form-livro').addEventListener('submit', salvarLivro);
  document.getElementById('cancelar-livro').addEventListener('click', () => {
    document.getElementById('dialogo-livro').close();
    livroEditandoId = null;
    aulaAtualLivros = null;
  });

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