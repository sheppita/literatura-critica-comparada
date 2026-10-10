// ===================================================
// APP.JS — Home (eixos)
// ===================================================

const API = '/api';

let ementaAtual = [];
let filtroAtual = 'todos';
let timeoutBusca = null;

// ---------- HELPERS ----------
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

// ---------- MÉTRICAS DE UM NÓ ----------
// Retorna { total, concluidas, todasConcluidas }
function metricasEixo(eixo) {
  let total = 0, concluidas = 0;
  eixo.disciplinas.forEach(d => {
    d.modulos.forEach(m => {
      m.temas.forEach(t => {
        t.aulas.forEach(a => {
          total++;
          if (a.concluida) concluidas++;
        });
      });
    });
  });
  return { total, concluidas, todasConcluidas: total > 0 && concluidas === total };
}

// ---------- CARREGAR ----------
async function carregarEmenta() {
  const container = document.getElementById('eixos');
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<p>Carregando os eixos…</p>';

  try {
    ementaAtual = await api('/ementa');
    atualizarContagens();
    renderizarCartoes();
    preencherSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// ---------- CONTAGENS DO FILTRO ----------
function atualizarContagens() {
  let total = 0, concluidos = 0;
  ementaAtual.forEach(e => {
    const m = metricasEixo(e);
    if (m.total > 0) {
      total++;
      if (m.todasConcluidas) concluidos++;
    }
  });
  const pendentes = total - concluidos;
  document.querySelector('[data-contagem="todos"]').textContent = total;
  document.querySelector('[data-contagem="concluidos"]').textContent = concluidos;
  document.querySelector('[data-contagem="pendentes"]').textContent = pendentes;
}

// ---------- RENDERIZAR CARTÕES ----------
function renderizarCartoes() {
  const container = document.getElementById('eixos');
  if (!ementaAtual.length) {
    container.innerHTML = '<p class="vazio">Nenhum eixo cadastrado ainda.</p>';
    return;
  }

  const filtrados = ementaAtual.filter(e => {
    const m = metricasEixo(e);
    if (filtroAtual === 'concluidos') return m.total > 0 && m.todasConcluidas;
    if (filtroAtual === 'pendentes') return m.total === 0 || !m.todasConcluidas;
    return true;
  });

  if (!filtrados.length) {
    container.innerHTML = '<p class="vazio">Nada por aqui com esse filtro.</p>';
    return;
  }

  container.innerHTML = filtrados.map(eixo => {
    const m = metricasEixo(eixo);
    const textoAulas = m.total === 0
      ? 'Nenhuma aula ainda'
      : `${m.concluidas}/${m.total} aulas`;

    const classeConcluida = m.todasConcluidas ? ' concluida' : '';

    return `
      <div class="cartao-eixo${classeConcluida}">
        <button class="botao-check" data-acao="toggle-concluida" data-numero="${eixo.numero}" type="button"
                title="${m.todasConcluidas ? 'Desmarcar tudo' : 'Marcar tudo como concluído'}">
          ${m.todasConcluidas ? '✓' : ''}
        </button>
        <a class="cartao-link" href="/eixo.html?numero=${eixo.numero}">
          <span class="cartao-numero">Eixo ${eixo.numero}</span>
          <h3 class="cartao-titulo">${escapar(eixo.titulo)}</h3>
          <span class="cartao-contagem">${textoAulas}</span>
        </a>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-acao="toggle-concluida"]').forEach(btn =>
    btn.addEventListener('click', toggleConcluida));
}

// ---------- TOGGLE ----------
async function toggleConcluida(evento) {
  const numero = evento.currentTarget.dataset.numero;
  try {
    await api(`/eixos/${numero}/concluida`, { method: 'PATCH' });
    await carregarEmenta();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
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

// ---------- CABEÇALHO STICKY ----------
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

// ---------- BOTÕES FLUTUANTES ----------
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

// ===================================================
// EVENTOS INICIAIS
// ===================================================
document.addEventListener('DOMContentLoaded', async () => {
  await carregarEmenta();
  configurarBusca();

  document.querySelectorAll('.filtro-capsula').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-capsula').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderizarCartoes();
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