// ===================================================
// APP.JS — Home
// Lista os 9 eixos como cartões clicáveis
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
  container.innerHTML = '<p>Carregando os eixos…</p>';

  try {
    ementaAtual = await api('/ementa');
    renderizarCartoes();
    preencherSubmenuEixos();
  } catch (e) {
    container.innerHTML = `<p class="erro">Erro ao carregar: ${escapar(e.message)}</p>`;
  } finally {
    container.setAttribute('aria-busy', 'false');
  }
}

// ---------- RENDERIZAR CARTÕES ----------
function renderizarCartoes() {
  const container = document.getElementById('eixos');
  if (!ementaAtual.length) {
    container.innerHTML = '<p class="vazio">Nenhum eixo cadastrado ainda.</p>';
    return;
  }

  container.innerHTML = ementaAtual.map(eixo => {
    let total = 0;
    let concluidas = 0;
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

    let textoAulas;
    if (total === 0) {
      textoAulas = 'Nenhuma aula ainda';
    } else {
      textoAulas = `${concluidas}/${total} aulas`;
    }

    return `
      <a class="cartao-eixo" href="/eixo.html?numero=${eixo.numero}">
        <span class="cartao-numero">Eixo ${eixo.numero}</span>
        <h3 class="cartao-titulo">${escapar(eixo.titulo)}</h3>
        <span class="cartao-contagem">${textoAulas}</span>
      </a>
    `;
  }).join('');
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
  await carregarEmenta();

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

  // --- Menu suspenso de eixos ---
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