// ===================================================
// BIBLIOGRAFIA.JS
// ===================================================

const API = '/api';

let livrosTodos = [];
let filtroAtual = 'todos';
let buscaLocal = '';
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

function extrairMarcador(titulo) {
  if (!titulo) return '';
  const m = String(titulo).match(/^\s*([0-9]+(?:\.[0-9]+)*|[A-Z])\s*[-–—]/);
  return m ? m[1] : '';
}

async function carregarLivros() {
  const container = document.getElementById('livros');
  container.setAttribute('aria-busy', 'true');
  container.innerHTML = '<p>Carregando…</p>';

  try {
    livrosTodos = await api('/livros');
    atualizarContagens();
    renderizarLivros();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

function atualizarContagens() {
  const total = livrosTodos.length;
  const tb = livrosTodos.filter(l => l.tipo === 'texto-base').length;
  const an = livrosTodos.filter(l => l.tipo === 'ancora').length;
  const rep = livrosTodos.filter(l => l.repetido).length;

  document.querySelector('[data-contagem="todos"]').textContent = total;
  document.querySelector('[data-contagem="texto-base"]').textContent = tb;
  document.querySelector('[data-contagem="ancora"]').textContent = an;
  document.querySelector('[data-contagem="repetidos"]').textContent = rep;

  document.getElementById('resumo-bibliografia').textContent =
    `${total} ${total === 1 ? 'livro' : 'livros'} · ${tb} texto-base · ${an} âncora`;
}

function renderizarLivros() {
  const container = document.getElementById('livros');

  const filtrados = livrosTodos.filter(l => {
    if (filtroAtual === 'texto-base' && l.tipo !== 'texto-base') return false;
    if (filtroAtual === 'ancora' && l.tipo !== 'ancora') return false;
    if (filtroAtual === 'repetidos' && !l.repetido) return false;
    return true;
  });

  let comBusca = filtrados;
  if (buscaLocal) {
    const q = buscaLocal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    comBusca = filtrados.filter(l => {
      const t = (l.titulo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const a = (l.autor || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return t.includes(q) || a.includes(q);
    });
  }

  const ordenados = [...comBusca].sort((a, b) => {
    const autA = (a.autor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const autB = (b.autor || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!autA && autB) return 1;
    if (autA && !autB) return -1;
    if (autA !== autB) return autA.localeCompare(autB);
    return (a.titulo || '').toLowerCase().localeCompare((b.titulo || '').toLowerCase());
  });

  if (!ordenados.length) {
    const msgs = {
      todos: 'Nenhum livro cadastrado ainda.',
      'texto-base': 'Nenhum texto-base cadastrado.',
      ancora: 'Nenhuma obra âncora cadastrada.',
      repetidos: 'Nenhum livro repetido. Tudo limpo! 🌿'
    };
    container.innerHTML = `<p class="vazio">${msgs[filtroAtual] || 'Nada aqui.'}</p>`;
    return;
  }

  container.innerHTML = ordenados.map(l => {
    const tipoBadge = l.tipo === 'ancora' ? 'Âncora' : 'Texto-base';
    const classeTipo = l.tipo === 'ancora' ? 'livro-ancora' : 'livro-base';
    const cap = l.capitulo ? ` — Cap. ${escapar(l.capitulo)}` : '';
    const descCap = l.descricao_capitulo
      ? `<span class="livro-descricao">${escapar(l.descricao_capitulo)}</span>` : '';

    const badgeRepetido = l.repetido
      ? `<span class="livro-repetido-badge" title="Esse livro aparece em ${l.ocorrencias} aulas">🔁 ${l.ocorrencias}x</span>`
      : '';

    const marcEixo = l.eixo_numero || '';
    const marcDisc = extrairMarcador(l.disciplina_titulo);
    const marcMod = extrairMarcador(l.modulo_titulo);
    const marcTema = extrairMarcador(l.tema_titulo);

    const urlEixo = `/eixo.html?numero=${l.eixo_numero}`;
    const urlDisc = `/disciplina.html?id=${l.disciplina_id}`;
    const urlMod = `/modulo.html?id=${l.modulo_id}`;
    const urlTema = `/tema.html?id=${l.tema_id}`;

    const contexto = `
      <div class="livro-contexto">
        <a href="${urlEixo}" class="ctx-link">Eixo ${marcEixo}</a>
        <span class="ctx-sep">›</span>
        <a href="${urlDisc}" class="ctx-link">${escapar(marcDisc || '?')}</a>
        <span class="ctx-sep">›</span>
        <a href="${urlMod}" class="ctx-link">${escapar(marcMod || '?')}</a>
        <span class="ctx-sep">›</span>
        <a href="${urlTema}" class="ctx-link">${escapar(marcTema || '?')}</a>
        <span class="ctx-sep">›</span>
        <span class="ctx-aula">${escapar(l.aula_titulo)}</span>
      </div>
    `;

    return `
      <article class="livro-card ${classeTipo}${l.repetido ? ' repetido' : ''}">
        <div class="livro-card-header">
          <span class="livro-tipo-badge">${tipoBadge}</span>
          ${badgeRepetido}
        </div>
        <h3 class="livro-card-titulo">${escapar(l.titulo)}${cap}</h3>
        ${l.autor ? `<p class="livro-card-autor">${escapar(l.autor)}</p>` : ''}
        ${descCap}
        ${contexto}
      </article>
    `;
  }).join('');
}

async function carregarSubmenuEixos() {
  try {
    const ementa = await api('/ementa');
    const submenu = document.getElementById('submenu-eixos');
    if (!submenu) return;
    submenu.innerHTML = ementa.map(e => `
      <li>
        <a href="/eixo.html?numero=${e.numero}">
          Eixo ${e.numero} — ${escapar(e.titulo)}
        </a>
      </li>
    `).join('');
  } catch {}
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
  await carregarLivros();
  await carregarSubmenuEixos();
  configurarBusca();

  document.querySelectorAll('.filtro-capsula').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroAtual = btn.dataset.filtro;
      document.querySelectorAll('.filtro-capsula').forEach(b => {
        b.classList.toggle('ativo', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderizarLivros();
    });
  });

  const inputLocal = document.getElementById('busca-local-input');
  if (inputLocal) {
    inputLocal.addEventListener('input', () => {
      buscaLocal = inputLocal.value.trim();
      renderizarLivros();
    });
  }

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