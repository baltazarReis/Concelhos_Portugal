import { map_distrito_concelhos } from './concelhos_map.js';
import { dadosConcelhos } from './info_concelhos.js';

// Concelhos em jogo: calculados no arranque a partir dos distritos escolhidos
// no menu inicial. Para debug num só distrito, abre "Escolher distritos",
// desmarca "Todos os distritos" e marca apenas esse.
let listaConcelhos = [];
let totalConcelhos = 0;

// Distritos selecionados no menu inicial.
// Por omissão, todos. A escolha do jogador mantém-se durante a sessão do
// separador (sessionStorage: sobrevive a "Jogar Novamente"/recarregar, mas
// desaparece quando o separador/navegador é fechado e o site volta a abrir).
const CHAVE_SESSAO_DISTRITOS = "distritosSelecionados";

function carregarSelecaoGuardada() {
  const todos = new Set(map_distrito_concelhos.keys());
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CHAVE_SESSAO_DISTRITOS));
    if (Array.isArray(guardado)) {
      // Ignora distritos que já não existam no mapa
      const validos = guardado.filter(d => todos.has(d));
      if (validos.length > 0) return new Set(validos);
    }
  } catch (e) {
    // sessionStorage indisponível ou conteúdo inválido: usa o default
  }
  return todos;
}

function guardarSelecao() {
  try {
    sessionStorage.setItem(CHAVE_SESSAO_DISTRITOS, JSON.stringify([...distritosSelecionados]));
  } catch (e) {
    // Ignora (ex.: modo privado restrito)
  }
}

let distritosSelecionados = carregarSelecaoGuardada();

// Total de concelhos quando se joga com todos os distritos (os 308)
const TOTAL_TODOS_CONCELHOS = Array.from(map_distrito_concelhos.values())
  .reduce((soma, lista) => soma + lista.length, 0);

let concelhosRestantes = [];
let concelhoAtual = null;
let pontuacao = 0;
let errosNoConcelhoAtual = 0;
let tentativasCerteiras = 0;
let tentativasTotais = 0;
let tempoSegundos = 0;
let intervaloTimer = null;
let jogoTerminado = false; // true quando o resumo final está a ser mostrado
let ocultarAvisoAjuda = false; // "Não mostrar novamente": vale só para o jogo em curso

// Efeitos Sonoros
const somAcerto = new Audio('./sounds/correct.mp3');
const somErro = new Audio('./sounds/wrong.mp3');

somAcerto.volume = 0.6;
somErro.volume = 0.25;

function tocarSom(audio, duracaoMs = null) {
  // 0. Cancela qualquer corte agendado por uma reprodução anterior deste
  //    mesmo áudio. Sem isto, um temporizador antigo (de um clique anterior)
  //    pode disparar sobre a reprodução atual e cortá-la num ponto
  //    imprevisível — é essa a causa dos cortes "aleatórios" a meio do som.
  if (audio._timeoutCorte) {
    clearTimeout(audio._timeoutCorte);
    audio._timeoutCorte = null;
  }

  // 1. Interrompe o som se já estiver a tocar e volta ao início
  audio.pause();
  audio.currentTime = 0;

  // 2. Toca o som a partir do início
  audio.play().catch(() => {
    // Evita erros de política de auto-play do browser
  });

  // 3. Corta o som após o tempo definido (se fornecido)
  if (duracaoMs) {
    audio._timeoutCorte = setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
      audio._timeoutCorte = null;
    }, duracaoMs);
  }
}

// INÍCIO: DECLARAÇÃO DE ELEMENTOS
const elNomeConcelho = document.getElementById("nome-concelho");
const elPontuacao = document.getElementById("pontuacao");
const elTentativas = document.getElementById("tentativas");
const elTimer = document.getElementById("timer");
const btnSkip = document.getElementById("btn-skip");
const elTooltip = document.getElementById("tooltip-concelho");

const menuInicial = document.getElementById("menu-inicial");
const btnIniciar = document.getElementById("btn-iniciar");
const elMenuDescricao = document.getElementById("menu-descricao");

// Elementos da seleção de distritos (menu inicial)
const btnDistritos = document.getElementById("btn-distritos");
const painelDistritos = document.getElementById("painel-distritos");
const elListaSelecao = document.getElementById("lista-distritos-selecao");
const elResumoSelecao = document.getElementById("resumo-selecao");
const elNotaRecorde = document.getElementById("nota-recorde");

// Elementos Fim de Jogo
const painelTopRight = document.querySelector(".painel-top-right");
const painelFimJogo = document.getElementById("painel-fim-jogo");
const elFimPontuacao = document.getElementById("fim-pontuacao");
const elFimTempo = document.getElementById("fim-tempo");
const elFimTentativas = document.getElementById("fim-tentativas");
const elFimPontaria = document.getElementById("fim-pontaria");
const elListaDistritos = document.getElementById("lista-distritos-resumo");
const btnReiniciar = document.getElementById("btn-reiniciar");

// Elementos do recorde (resumo de fim de jogo)
const elEstatisticasGerais = document.querySelector(".estatisticas-gerais");
const elRecordeEstado = document.getElementById("fim-recorde-estado");
const elComparacaoRecorde = document.getElementById("comparacao-recorde");
const btnRecorde = document.getElementById("btn-recorde");

// Elementos do Painel de Ajuda / Pistas
const btnAjuda = document.getElementById("btn-ajuda");
const modalInfo = document.getElementById("modal-info-concelho");
const fecharModal = document.getElementById("fechar-modal");
const modalTitulo = document.getElementById("modal-titulo-concelho");
const modalDescricao = document.getElementById("modal-descricao");
const modalImagem = document.getElementById("modal-imagem");

// Elementos do Zoom da Heráldica (Modal Zoom)
const modalZoom = document.getElementById("modal-zoom-heraldica");
const fecharZoom = document.getElementById("fechar-zoom-heraldica");
const imagemZoom = document.getElementById("imagem-zoom-heraldica");

// Elementos da Lightbox
const lightboxModal = document.getElementById("lightbox-modal");
const lightboxImagem = document.getElementById("lightbox-imagem");
const btnFecharLightbox = document.getElementById("lightbox-fechar");
const btnAnteriorLightbox = document.getElementById("lightbox-anterior");
const btnSeguinteLightbox = document.getElementById("lightbox-seguinte");

// Objeto para registar os acertos sem erros por distrito
let acertosPorDistrito = {};
// FIM: DECLARAÇÃO DE ELEMENTOS

// INÍCIO: LÓGICA DE INÍCIO E REINÍCIO
window.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  configurarZoomEPan();

  construirListaDistritos();
  atualizarMenuSelecao();

  // Abre/fecha o painel lateral de distritos (o menu de início mantém-se aberto)
  btnDistritos.addEventListener("click", () => {
    const aberto = painelDistritos.classList.toggle("escondido") === false;
    btnDistritos.setAttribute("aria-expanded", String(aberto));
    btnDistritos.classList.toggle("ativo", aberto);
  });

  btnIniciar.addEventListener("click", () => {
    if (distritosSelecionados.size === 0) return;
    menuInicial.classList.add("escondido");
    iniciarJogoDirecto();
  });

  // INÍCIO: EVENTO DE REINICIAR (RELOAD DA PÁGINA)
  btnReiniciar.addEventListener("click", () => {
    window.location.reload();
  });
// FIM: EVENTO DE REINICIAR (RELOAD DA PÁGINA)
});

// INÍCIO: SELEÇÃO DE DISTRITOS (MENU INICIAL)
let checkboxTodos = null;
const checkboxesDistritos = new Map(); // distrito -> <input>

function contarConcelhosSelecionados() {
  let total = 0;
  distritosSelecionados.forEach(distrito => {
    total += (map_distrito_concelhos.get(distrito) || []).length;
  });
  return total;
}

function criarLinhaDistrito(nome, nConcelhos, selecionado, classeExtra = "") {
  const label = document.createElement("label");
  label.className = `linha-distrito ${classeExtra}`.trim();

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = selecionado;

  const spanNome = document.createElement("span");
  spanNome.className = "nome-distrito";
  spanNome.textContent = nome;

  label.append(input, spanNome);

  if (nConcelhos !== null) {
    const spanN = document.createElement("span");
    spanN.className = "n-concelhos";
    spanN.textContent = nConcelhos;
    label.appendChild(spanN);
  }

  return { label, input };
}

function construirListaDistritos() {
  elListaSelecao.innerHTML = "";
  checkboxesDistritos.clear();

  // Checkbox mestre: "Todos os distritos" (selecionada por omissão)
  const todos = criarLinhaDistrito("Todos os distritos", null,
    distritosSelecionados.size === map_distrito_concelhos.size, "linha-todos");
  checkboxTodos = todos.input;
  checkboxTodos.addEventListener("change", () => {
    distritosSelecionados = checkboxTodos.checked
      ? new Set(map_distrito_concelhos.keys())
      : new Set();
    checkboxesDistritos.forEach(input => { input.checked = checkboxTodos.checked; });
    atualizarMenuSelecao();
  });
  elListaSelecao.appendChild(todos.label);

  // Uma checkbox por distrito / região autónoma (ordem do map_distrito_concelhos)
  map_distrito_concelhos.forEach((concelhos, distrito) => {
    const linha = criarLinhaDistrito(distrito, concelhos.length, distritosSelecionados.has(distrito));
    linha.input.addEventListener("change", () => {
      if (linha.input.checked) distritosSelecionados.add(distrito);
      else distritosSelecionados.delete(distrito);

      // Se alguma for desmarcada, "Todos os distritos" desmarca; se todas voltarem, marca
      checkboxTodos.checked = distritosSelecionados.size === map_distrito_concelhos.size;
      atualizarMenuSelecao();
    });
    checkboxesDistritos.set(distrito, linha.input);
    elListaSelecao.appendChild(linha.label);
  });
}

function atualizarMenuSelecao() {
  guardarSelecao();
  const nConcelhos = contarConcelhosSelecionados();
  const todosSelecionados = distritosSelecionados.size === map_distrito_concelhos.size;

  btnIniciar.disabled = nConcelhos === 0;

  if (nConcelhos === 0) {
    elMenuDescricao.textContent = "Seleciona pelo menos um distrito para poderes jogar.";
    elResumoSelecao.textContent = "Nenhum distrito selecionado";
  } else {
    elMenuDescricao.textContent = todosSelecionados
      ? `Identifica os ${nConcelhos} concelhos de Portugal no mapa.`
      : `Identifica os ${nConcelhos} concelhos dos distritos selecionados no mapa.`;
    elResumoSelecao.textContent =
      `${distritosSelecionados.size} de ${map_distrito_concelhos.size} selecionados · ${nConcelhos} concelhos`;
  }
  elResumoSelecao.classList.toggle("vazio", nConcelhos === 0);

  // Explica que o recorde só é guardado com todos os distritos (os 308 concelhos)
  const regra = `Recorde: só são guardados jogos com todos os distritos (${TOTAL_TODOS_CONCELHOS} concelhos).`;
  elNotaRecorde.textContent = `${regra} ${todosSelecionados ? "Esta seleção conta." : "Esta seleção não conta."}`;
  elNotaRecorde.classList.toggle("conta", todosSelecionados);
}

// Pinta a cinzento os concelhos cujo distrito não foi selecionado
function marcarConcelhosForaDoJogo() {
  const emJogo = new Set(listaConcelhos);
  document.querySelectorAll("svg path[data-concelho]").forEach(path => {
    path.classList.toggle("fora-do-jogo", !emJogo.has(path.getAttribute("data-concelho")));
  });
}
// FIM: SELEÇÃO DE DISTRITOS (MENU INICIAL)

function iniciarJogoDirecto() {
  // Só os concelhos dos distritos selecionados entram no jogo
  listaConcelhos = Array.from(map_distrito_concelhos.entries())
    .filter(([distrito]) => distritosSelecionados.has(distrito))
    .flatMap(([, lista]) => lista);
  totalConcelhos = listaConcelhos.length;
  marcarConcelhosForaDoJogo();

  concelhosRestantes = [...listaConcelhos];
  pontuacao = 0;
  tentativasTotais = 0;
  tentativasCerteiras = 0;
  tempoSegundos = 0;
  jogoTerminado = false;
  ocultarAvisoAjuda = false; // em cada jogo novo o aviso volta a aparecer
  
  // Inicializa contador por distrito
  acertosPorDistrito = {};
  map_distrito_concelhos.forEach((_, distrito) => {
    acertosPorDistrito[distrito] = 0;
  });

  iniciarTimer();
  proximoConcelho();
}

// FIM: LÓGICA DE INÍCIO E REINÍCIO

function proximoConcelho() {
  if (concelhosRestantes.length === 0) {
    concelhoAtual = null;
    return;
  }
  
  errosNoConcelhoAtual = 0;
  
  const indiceAleatorio = Math.floor(Math.random() * concelhosRestantes.length);

  // DEBUG CONCELHO 'Lisboa';//_

  concelhoAtual = concelhosRestantes.splice(indiceAleatorio, 1)[0];
  
  elNomeConcelho.textContent = concelhoAtual;
  elPontuacao.textContent = `${pontuacao}/${totalConcelhos}`;
  elTentativas.textContent = tentativasTotais;
}

// Concelho "não jogável": já respondido (acertado ou passado à frente) ou fora do jogo
function ehConcelhoNaoJogavel(el) {
  return el.classList.contains("correto") ||
         el.classList.contains("com-erros") ||
         el.classList.contains("pular") ||
         el.classList.contains("fora-do-jogo");
}

// Duplo clique (ou duplo toque) num concelho não jogável abre o painel de informação.
// É detetado a partir de dois cliques seguidos no MESMO concelho, o que funciona também
// em ecrãs táteis. Nunca conta como tentativa e nunca penaliza o concelho em jogo.
const JANELA_DUPLO_CLIQUE_MS = 450;
let ultimoCliqueInfo = { el: null, t: 0 };

function registarCliqueInfo(el) {
  const agora = performance.now();
  if (ultimoCliqueInfo.el === el && agora - ultimoCliqueInfo.t < JANELA_DUPLO_CLIQUE_MS) {
    ultimoCliqueInfo = { el: null, t: 0 };
    abrirPainelInfo(el.getAttribute("data-concelho"));
  } else {
    ultimoCliqueInfo = { el, t: agora };
  }
}

// INÍCIO: REGISTO DE ACERTOS NO CLIQUE
document.querySelectorAll("svg path[data-concelho]").forEach(path => {
  path.addEventListener("click", (e) => {
    if (e.button !== 0) return;

    const elClicado = e.target;

    // Cliques em concelhos já respondidos (acertados ou passados à frente) ou fora
    // do jogo (distrito não selecionado): não contam como tentativa nem interferem
    // com o som que estiver a tocar. Dois cliques seguidos abrem a informação.
    // (Vem antes do "!concelhoAtual" para também funcionar depois do fim do jogo.)
    if (ehConcelhoNaoJogavel(elClicado)) {
      registarCliqueInfo(elClicado);
      return;
    }

    if (!concelhoAtual) return;

    const concelhoClicado = elClicado.getAttribute("data-concelho");
    tentativasTotais++;
    elTentativas.textContent = tentativasTotais;

    if (concelhoClicado === concelhoAtual) {
      fecharPainelAjuda();
      tocarSom(somAcerto, 2000);
      tentativasCerteiras++;
      
      // Procura o distrito pertencente
      let distritoDoConcelho = null;
      for (const [distrito, lista] of map_distrito_concelhos.entries()) {
        if (lista.includes(concelhoClicado)) {
          distritoDoConcelho = distrito;
          break;
        }
      }

      if (errosNoConcelhoAtual === 0) {
        pintarConcelho(concelhoClicado, "correto");
        pontuacao++;
        if (distritoDoConcelho) {
          acertosPorDistrito[distritoDoConcelho]++;
        }
      } else {
        pintarConcelho(concelhoClicado, "com-erros");
      }
      
      processarFimDeJogada();
    } else {
      tocarSom(somErro, 2000);
      errosNoConcelhoAtual++;
    }
  });

  // Hover Tooltip
  path.addEventListener("mouseenter", (e) => {
    const el = e.target;
    if (ehConcelhoNaoJogavel(el) && elTooltip) {
      const nome = document.createElement("span");
      nome.className = "tooltip-nome";
      nome.textContent = el.getAttribute("data-concelho");

      const dica = document.createElement("span");
      dica.className = "tooltip-dica";
      dica.textContent = "Duplo clique para ver mais informação";

      elTooltip.replaceChildren(nome, dica);
      elTooltip.classList.add("ativo");
    }
  });

  path.addEventListener("mouseleave", () => {
    if (elTooltip) elTooltip.classList.remove("ativo");
  });
});
// FIM: REGISTO DE ACERTOS NO CLIQUE

// Botão Passar à Frente -> Vermelho
btnSkip.addEventListener("click", () => {
  if (!concelhoAtual) return;
  
  fecharPainelAjuda();
  pintarConcelho(concelhoAtual, "pular");
  processarFimDeJogada();
});

// Função central para avançar ou terminar o jogo
function processarFimDeJogada() {
  proximoConcelho();

  // Avalia se a lista esgotou DEPOIS de processar a jogada atual
  if (!concelhoAtual) {
    elPontuacao.textContent = `${pontuacao}/${totalConcelhos}`;
    elNomeConcelho.textContent = "Fim do Jogo!";
    finalizarJogo();
  }
}

// Função para pintar o concelho (incluindo duplicados/sufixos)
function pintarConcelho(nomeConcelho, classeCSS) {
  const elementos = document.querySelectorAll(
    `svg path[data-concelho="${nomeConcelho}"], svg path[data-concelho^="${nomeConcelho} ("]`
  );
  
  elementos.forEach(el => {
    el.removeAttribute("style");
    el.classList.add(classeCSS);
  });
}

function iniciarTimer() {
  intervaloTimer = setInterval(() => {
    tempoSegundos++;
    const min = String(Math.floor(tempoSegundos / 60)).padStart(2, '0');
    const seg = String(tempoSegundos % 60).padStart(2, '0');
    elTimer.textContent = `${min}:${seg}`;
  }, 1000);
}

// INÍCIO: FINALIZAR JOGO E RESUMO ORDENADO POR PERCENTAGEM
function finalizarJogo() {
  clearInterval(intervaloTimer);
  fecharPainelAjuda();
  jogoTerminado = true;
  
  // Oculta o HUD da direita e mostra o painel de resumo
  painelTopRight.classList.add("escondido");
  painelFimJogo.classList.remove("escondido");

  elFimPontuacao.textContent = `${pontuacao}/${totalConcelhos} - ${Math.round((pontuacao / totalConcelhos) * 100)}%`;
  elFimTempo.textContent = elTimer.textContent;
  elFimTentativas.textContent = tentativasTotais;
  const pontaria = calcularPontaria(tentativasCerteiras, tentativasTotais);
  elFimPontaria.textContent = pontaria + "%";

  // Limpa a lista
  elListaDistritos.innerHTML = "";
  
  // 1. Mapeia os dados de cada distrito para um array com a percentagem calculada
  const resumoDistritos = Array.from(map_distrito_concelhos.entries())
    .filter(([distrito]) => distritosSelecionados.has(distrito))
    .map(([distrito, concelhos]) => {
    const totalConcelhosDistrito = concelhos.length;
    const acertos = acertosPorDistrito[distrito] || 0;
    const percentagem = Math.round((acertos / totalConcelhosDistrito) * 100);

    return {
      distrito,
      acertos,
      totalConcelhosDistrito,
      percentagem
    };
  });

  resumoDistritos.sort((a, b) => b.percentagem - a.percentagem);

  resumoDistritos.forEach(itemData => {
    const item = document.createElement("div");
    item.className = "item-distrito";
    item.textContent = `${itemData.distrito}: ${itemData.acertos}/${itemData.totalConcelhosDistrito} - ${itemData.percentagem}%`;
    
    elListaDistritos.appendChild(item);
  });

// Recorde: guarda (se for jogo completo) e prepara a comparação
  prepararRecorde({
    pontuacao: pontuacao,
    tempo: tempoSegundos,
    tentativas: tentativasTotais,
    pontaria: pontaria,
    acertosPorDistrito: { ...acertosPorDistrito },
  }, resumoDistritos);
}

// INÍCIO: RECORDE DO JOGADOR
// O recorde só é guardado em jogos com TODOS os distritos (os 308 concelhos).
// Guarda: tempo, pontuação, tentativas, pontaria e acertos por distrito.
// Critério do melhor jogo: mais pontos > melhor pontaria > menor tempo > menos
// tentativas. Fica no browser (localStorage), por isso sobrevive entre visitas.
const CHAVE_RECORDE = "recordeJogoConcelhos";
const MENOS = "\u2212"; // sinal de menos tipográfico, mais visível que "-"

function calcularPontaria(certeiras, totais) {
  return totais > 0 ? Math.floor((certeiras / totais) * 100) : 0;
}

function formatarTempo(segundos) {
  const min = String(Math.floor(segundos / 60)).padStart(2, "0");
  const seg = String(segundos % 60).padStart(2, "0");
  return `${min}:${seg}`;
}

const formatadorPercentagem = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function lerRecorde() {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE_RECORDE));
    const numerosOk = ["pontuacao", "tempo", "tentativas", "pontaria"].every(k => Number.isFinite(r?.[k]));
    if (numerosOk && r.acertosPorDistrito && typeof r.acertosPorDistrito === "object") {
      return r;
    }
  } catch (e) {
    // sem localStorage ou conteúdo inválido: não há recorde
  }
  return null;
}

function guardarRecorde(registo) {
  try {
    localStorage.setItem(CHAVE_RECORDE, JSON.stringify(registo));
    return true;
  } catch (e) {
    return false;
  }
}

// 1 = a melhor que b, -1 = a pior que b, 0 = iguais
function compararJogos(a, b) {
  if (a.pontuacao !== b.pontuacao) return a.pontuacao > b.pontuacao ? 1 : -1;
  if (a.pontaria !== b.pontaria) return a.pontaria > b.pontaria ? 1 : -1;
  if (a.tempo !== b.tempo) return a.tempo < b.tempo ? 1 : -1;
  if (a.tentativas !== b.tentativas) return a.tentativas < b.tentativas ? 1 : -1;
  return 0;
}

// Diferença atual vs recorde. "melhor" = o atual é melhor que o recorde
// (mais pontos/pontaria, ou menos tempo/tentativas). A percentagem é relativa ao recorde.
function calcularDiferenca(atual, recorde, maiorEMelhor) {
  const bruta = atual - recorde;
  if (bruta === 0) return { estado: "igual" };
  const magnitude = Math.abs(bruta);
  return {
    estado: (bruta > 0) === maiorEMelhor ? "melhor" : "pior",
    magnitude,
    bruta, // Guarda o valor bruto para sabermos se o resultado é positivo ou negativo
    percentagem: recorde !== 0 ? (magnitude / Math.abs(recorde)) * 100 : null,
  };
}

// Formata o texto da diferença com o sinal correto (+ ou −) baseado na variação real
function textoDiferenca(dif, formatarMagnitude, chave) {
  if (dif.estado === "igual") return "=";
  
  const sinal = dif.bruta > 0 ? "+" : MENOS;

  // Se for pontaria, mostramos apenas a diferença em percentagem direta (sem cálculo relativo)
  if (chave === "pontaria") {
    return `${sinal}${formatarMagnitude(dif.magnitude)}`;
  }

  if (dif.estado === "melhor") {
    const pct = dif.percentagem === null ? "" : ` (${sinal}${formatadorPercentagem.format(dif.percentagem)}%)`;
    return `${sinal}${formatarMagnitude(dif.magnitude)}`;
  } else {
    return `${sinal}${formatarMagnitude(dif.magnitude)}`;
  }
}

// Categorias gerais (mesma ordem do resumo)
const CATEGORIAS_RECORDE = [
  { chave: "pontuacao",  rotulo: "Pontuação",  maiorEMelhor: true,
    valor: v => `${v}/${TOTAL_TODOS_CONCELHOS}`, magnitude: m => String(m) },
  { chave: "tempo",      rotulo: "Tempo",      maiorEMelhor: false,
    valor: v => formatarTempo(v), magnitude: m => formatarTempo(m) },
  { chave: "tentativas", rotulo: "Tentativas", maiorEMelhor: false,
    valor: v => String(v), magnitude: m => String(m) },
  { chave: "pontaria",   rotulo: "Pontaria",   maiorEMelhor: true,
    valor: v => `${v}%`, magnitude: m => `${m}%` },
];

function criarCelula(tag, texto, classe = "") {
  const el = document.createElement(tag);
  el.textContent = texto;
  if (classe) el.className = classe;
  return el;
}

function criarCabecalho(rotulos) {
  const linha = document.createElement("tr");
  rotulos.forEach(r => linha.appendChild(criarCelula("th", r)));
  return linha;
}

function criarCelulaDiferenca(dif, formatarMagnitude) {
  return criarCelula("td", textoDiferenca(dif, formatarMagnitude), `dif ${dif.estado}`);
}

// Constrói a comparação: tabela geral + tabela por distrito (acertos sem erros)
function desenharComparacao(atual, recorde, resumoDistritos, rotuloRecorde) {
  const legenda = document.createElement("p");
  legenda.className = "legenda-recorde";

  // Tabela geral
  const tabelaGeral = document.createElement("table");
  tabelaGeral.className = "tabela-recorde";
  tabelaGeral.appendChild(criarCabecalho(["", "Este jogo", rotuloRecorde, "Diferença"]));
  CATEGORIAS_RECORDE.forEach(cat => {
    const linha = document.createElement("tr");
    linha.appendChild(criarCelula("td", cat.rotulo));
    linha.appendChild(criarCelula("td", cat.valor(atual[cat.chave])));
    linha.appendChild(criarCelula("td", cat.valor(recorde[cat.chave])));
    
    const dif = calcularDiferenca(atual[cat.chave], recorde[cat.chave], cat.maiorEMelhor);
    linha.appendChild(criarCelula("td", textoDiferenca(dif, cat.magnitude, cat.chave), `dif ${dif.estado}`));
    
    tabelaGeral.appendChild(linha);
  });

  // Tabela por distrito (mesma ordem da lista do resumo)
  const tabelaDistritos = document.createElement("table");
  tabelaDistritos.className = "tabela-recorde tabela-distritos-recorde";
  tabelaDistritos.appendChild(criarCabecalho(["Distrito", "Este jogo", rotuloRecorde, "Diferença"]));
  resumoDistritos.forEach(({ distrito, acertos, totalConcelhosDistrito }) => {
    const linha = document.createElement("tr");
    linha.appendChild(criarCelula("td", distrito));
    linha.appendChild(criarCelula("td", `${acertos}/${totalConcelhosDistrito}`));

    const acertosRecorde = recorde.acertosPorDistrito[distrito];
    if (Number.isFinite(acertosRecorde)) {
      linha.appendChild(criarCelula("td", `${acertosRecorde}/${totalConcelhosDistrito}`));
      linha.appendChild(criarCelulaDiferenca(calcularDiferenca(acertos, acertosRecorde, true), m => String(m)));
    } else {
      linha.appendChild(criarCelula("td", "\u2014"));
      linha.appendChild(criarCelula("td", "\u2014", "dif igual"));
    }
    tabelaDistritos.appendChild(linha);
  });

  const caixaDistritos = document.createElement("div");
  caixaDistritos.className = "caixa-distritos-scroll";
  caixaDistritos.appendChild(tabelaDistritos);

  elComparacaoRecorde.replaceChildren(legenda, tabelaGeral, caixaDistritos);
}

function definirEstadoRecorde(texto, classe) {
  elRecordeEstado.textContent = texto;
  elRecordeEstado.className = `fim-recorde-estado ${classe}`;
}

function prepararRecorde(atual, resumoDistritos) {
  const anterior = lerRecorde();
  const contaParaRecorde = distritosSelecionados.size === map_distrito_concelhos.size;

  // Estado inicial: resumo normal, comparação escondida
  elEstatisticasGerais.classList.remove("escondido");
  elListaDistritos.classList.remove("escondido");
  elComparacaoRecorde.classList.add("escondido");
  painelFimJogo.classList.remove("modo-comparacao");
  btnRecorde.classList.add("escondido");

  let rotuloRecorde = "Melhor jogo";
  let textoMostrar = "Mostrar melhor jogo";
  let textoEsconder = "Esconder melhor jogo";

  if (!contaParaRecorde) {
    definirEstadoRecorde(
      `Este jogo não conta para o recorde: só são guardados jogos com todos os distritos (${TOTAL_TODOS_CONCELHOS} concelhos).`,
      "aviso"
    );
    return;
  }

  if (!anterior) {
    const guardado = guardarRecorde({ ...atual, data: Date.now() });
    definirEstadoRecorde(
      guardado ? "Primeiro recorde guardado!" : "Primeiro recorde! (não foi possível guardá-lo neste browser)",
      guardado ? "novo" : "aviso"
    );
    return; // ainda não há recorde anterior com que comparar
  }

  const resultado = compararJogos(atual, anterior);
  if (resultado > 0) {
    const guardado = guardarRecorde({ ...atual, data: Date.now() });
    definirEstadoRecorde(
      guardado ? "Novo recorde!" : "Novo recorde! (não foi possível guardá-lo neste browser)",
      guardado ? "novo" : "aviso"
    );
    // Compara com o recorde que acabou de ser superado
    rotuloRecorde = "Recorde anterior";
    textoMostrar = "Mostrar recorde anterior";
    textoEsconder = "Esconder recorde anterior";
  } 
  desenharComparacao(atual, anterior, resumoDistritos, rotuloRecorde);
  btnRecorde.textContent = textoMostrar;
  btnRecorde.classList.remove("escondido");
  btnRecorde.onclick = () => {
    const mostrar = elComparacaoRecorde.classList.toggle("escondido") === false;
    elEstatisticasGerais.classList.toggle("escondido", mostrar);
    elListaDistritos.classList.toggle("escondido", mostrar);
    painelFimJogo.classList.toggle("modo-comparacao", mostrar);
    btnRecorde.textContent = mostrar ? textoEsconder : textoMostrar;
  };
}

// FIM: RECORDE DO JOGADOR



// INÍCIO: GESTÃO DO PAINEL DE AJUDA / PISTAS
// Elementos da caixa de confirmação da informação adicional
const modalConfirmarAjuda = document.getElementById("modal-confirmar-ajuda");
const chkNaoMostrarAjuda = document.getElementById("confirmar-ajuda-nao-mostrar");
const btnConfirmarFechar = document.getElementById("confirmar-ajuda-fechar");
const btnConfirmarContinuar = document.getElementById("confirmar-ajuda-continuar");

// Revela a informação do concelho em jogo: é aqui que se perde o ponto desse concelho
function revelarInformacaoConcelhoAtual() {
  if (!concelhoAtual) return;

  errosNoConcelhoAtual++;
  abrirPainelInfo(concelhoAtual);
}

function abrirConfirmacaoAjuda() {
  chkNaoMostrarAjuda.checked = true; // por omissão, selecionada
  modalConfirmarAjuda.classList.remove("escondido");
  btnConfirmarFechar.focus(); // foco na opção segura
}

function fecharConfirmacaoAjuda() {
  modalConfirmarAjuda.classList.add("escondido");
}

// O botão "Informação Adicional" pede confirmação antes de revelar. Não pergunta se:
//  - o jogador já escolheu "Não mostrar novamente" neste jogo; ou
//  - o concelho já perdeu o ponto (erro anterior ou informação já revelada),
//    caso em que o aviso já não teria sentido.
btnAjuda.addEventListener("click", () => {
  if (!concelhoAtual) return;

  if (ocultarAvisoAjuda || errosNoConcelhoAtual > 0) {
    revelarInformacaoConcelhoAtual();
  } else {
    abrirConfirmacaoAjuda();
  }
});

// "Fechar": não revela nada e não penaliza (a opção "Não mostrar novamente" só
// vale ao continuar, para quem desiste não perder o aviso sem querer)
btnConfirmarFechar.addEventListener("click", fecharConfirmacaoAjuda);

btnConfirmarContinuar.addEventListener("click", () => {
  if (chkNaoMostrarAjuda.checked) ocultarAvisoAjuda = true;
  fecharConfirmacaoAjuda();
  revelarInformacaoConcelhoAtual();
});

// Clicar fora da caixa ou carregar em Esc equivale a "Fechar"
modalConfirmarAjuda.addEventListener("click", (e) => {
  if (e.target === modalConfirmarAjuda) fecharConfirmacaoAjuda();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalConfirmarAjuda.classList.contains("escondido")) {
    fecharConfirmacaoAjuda();
  }
});

// Identifica o pedido de abertura mais recente: evita que uma resposta atrasada
// mostre o concelho errado ou reabra um painel que entretanto foi fechado
let pedidoInfoId = 0;

// Abre o painel de informação de um concelho. É usado pelo botão de ajuda (concelho em
// jogo) e pelo duplo clique (concelhos já jogados). Se já houver um painel aberto,
// é simplesmente substituído pelo novo. Não mexe em pontuação, tentativas nem pontaria.
async function abrirPainelInfo(nomeConcelho) {
  const pedido = ++pedidoInfoId;

  modalTitulo.textContent = nomeConcelho;
  modalDescricao.innerHTML = "";
  modalImagem.classList.add("escondido");
  modalImagem.src = "";

  const extensoes = [".png", ".webp", ".jfif", ".gif", ".jpg", ".jpeg"];
  let imagemEncontrada = null;

  // Percorre as extensões e verifica qual existe no servidor/servidor local
  for (const ext of extensoes) {
    const caminho = `./images/Heráldicas Municipais/${encodeURIComponent(nomeConcelho)}${ext}`;
    try {
      const resposta = await fetch(caminho, { method: "HEAD" });
      if (resposta.ok) {
        imagemEncontrada = caminho;
        break; // Encontrou o ficheiro correto, para de procurar
      }
    } catch (e) {
      // Continua para a próxima extensão se falhar
    }
  }

  // Entretanto o painel foi fechado ou pediu-se outro concelho: abandona
  if (pedido !== pedidoInfoId) return;

  // Se encontrou a extensão correta, exibe-a
  if (imagemEncontrada) {
    modalImagem.src = imagemEncontrada;
    modalImagem.classList.remove("escondido");
  }

  const dados = dadosConcelhos[nomeConcelho];

  if (dados) {
    let htmlGaleria = "";

    if (dados.imagens && dados.imagens.length > 0) {
      htmlGaleria = `<div class="galeria-concelho">`;
      dados.imagens.forEach((imgUrl, idx) => {
        htmlGaleria += `<img src="${imgUrl}" class="galeria-miniatura" data-index="${idx}" alt="Fotografia de ${nomeConcelho}">`;
      });
      htmlGaleria += `</div>`;
    }

    // A GALERIA FICA EM CIMA DA DESCRIÇÃO/PISTAS
    modalDescricao.innerHTML = htmlGaleria + dados.pistas;

    // Regista o clique nas miniaturas recém-criadas
    if (dados.imagens && dados.imagens.length > 0) {
      const miniaturas = modalDescricao.querySelectorAll(".galeria-miniatura");
      miniaturas.forEach(miniatura => {
        miniatura.addEventListener("click", (e) => {
          const index = parseInt(e.target.getAttribute("data-index"), 10);
          abrirLightbox(dados.imagens, index);
        });
      });
    }
  } else {
    modalDescricao.innerHTML = `<p>Informações e pistas sobre o concelho de <strong>${nomeConcelho}</strong> estarão disponíveis brevemente.</p>`;
  }

  modalInfo.classList.remove("escondido");

  // O painel ocupa a lateral direita: esconde temporariamente o que lá estiver
  // (o HUD durante o jogo, o resumo no fim do jogo)
  if (jogoTerminado) {
    painelFimJogo.classList.add("escondido");
  } else if (painelTopRight) {
    painelTopRight.classList.add("escondido");
  }
}

function fecharPainelAjuda() {
  pedidoInfoId++; // cancela qualquer abertura ainda pendente
  if (modalInfo) modalInfo.classList.add("escondido");
  if (modalImagem) {
    modalImagem.src = "";
    modalImagem.classList.add("escondido");
  }

  // Repõe o que o painel tinha escondido: o resumo reaparece automaticamente
  // no fim do jogo; durante o jogo volta o HUD
  if (jogoTerminado) {
    painelFimJogo.classList.remove("escondido");
  } else if (painelTopRight) {
    painelTopRight.classList.remove("escondido");
  }
}

fecharModal.addEventListener("click", fecharPainelAjuda);

// 1. Torna a imagem da heráldica no painel lateral clicável
if (modalImagem) {
  modalImagem.style.cursor = "zoom-in";
  modalImagem.addEventListener("click", () => {
    if (modalImagem.src && !modalImagem.classList.contains("escondido") && modalZoom && imagemZoom) {
      imagemZoom.src = modalImagem.src;
      modalZoom.classList.remove("escondido");
    }
  });
}

// 2. Função para fechar o zoom e impedir que o clique afete elementos por baixo
function fecharModalZoom(e) {
  if (e) {
    e.stopPropagation(); // Impede que o clique passe para o mapa ou botões inferiores
    e.preventDefault();
  }
  if (modalZoom) modalZoom.classList.add("escondido");
  if (imagemZoom) imagemZoom.src = "";
}

// 3. Eventos para fechar (no 'X' ou em qualquer parte do ecrã)
if (fecharZoom) {
  fecharZoom.addEventListener("click", fecharModalZoom);
}

if (modalZoom) {
  modalZoom.addEventListener("click", (e) => {
    fecharModalZoom(e);
  });
}

// ZOOM E PAN NO MAPA
function configurarZoomEPan() {
  const wrapper = document.getElementById("mapa-wrapper");
  const svg = document.getElementById("mapa-svg");

  // Lê o viewBox original do SVG (a vista completa do mapa) em vez de
  // usar transform:scale() no CSS. Assim o zoom redesenha sempre o
  // vetor a partir do zero, nunca "esticando" um bitmap já renderizado
  // — por isso fica nítido em qualquer nível de zoom, não só em repouso.
  const [baseX, baseY, baseW, baseH] = svg
    .getAttribute("viewBox")
    .trim()
    .split(/\s+/)
    .map(Number);

  let vx = baseX;
  let vy = baseY;
  let vw = baseW;
  let vh = baseH;
  let zoom = 1;
  const ZOOM_MAX = 4;

  // Em ecrãs pequenos (telemóvel), começa com um zoom ligeiramente mais
  // aproximado para facilitar o primeiro toque nos concelhos.
  const ZOOM_INICIAL_MOBILE = 1.3;

  function ehMobile() {
    return window.matchMedia("(max-width: 768px)").matches;
  }

  function estadoInicial() {
    const z = ehMobile() ? ZOOM_INICIAL_MOBILE : 1;
    const w = baseW / z;
    const h = baseH / z;
    return {
      zoom: z,
      vw: w,
      vh: h,
      vx: baseX + (baseW - w) / 2,
      vy: baseY + (baseH - h) / 2,
    };
  }

  ({ zoom, vw, vh, vx, vy } = estadoInicial());

  let isDragging = false;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragStartVx = 0;
  let dragStartVy = 0;

  function aplicarViewBox() {
    svg.setAttribute("viewBox", `${vx} ${vy} ${vw} ${vh}`);
  }

  function pontoParaSvg(clientX, clientY) {
    const rect = wrapper.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return { x: vx + relX * vw, y: vy + relY * vh, relX, relY };
  }

  function limitarPan() {
    const margemX = baseW * 0.15; 
    const margemY = baseH * 0.30; 

    vx = Math.min(Math.max(vx, baseX - margemX), baseX + baseW - vw + margemX);
    vy = Math.min(Math.max(vy, baseY - margemY), baseY + baseH - vh + margemY);
  }

  // Zoom no ponto EXATO do cursor
  wrapper.addEventListener("wheel", (e) => {
    e.preventDefault();

    const antes = pontoParaSvg(e.clientX, e.clientY);
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const novoZoom = Math.min(Math.max(1, zoom * factor), ZOOM_MAX);
    if (novoZoom === zoom) return;

    zoom = novoZoom;
    vw = baseW / zoom;
    vh = baseH / zoom;

    if (zoom === 1) {
      // Se voltar ao zoom base, recentra automaticamente o mapa
      vx = baseX;
      vy = baseY;
    } else {
      vx = antes.x - antes.relX * vw;
      vy = antes.y - antes.relY * vh;
      limitarPan();
    }

    aplicarViewBox();
  });

  // Arrasto permitido APENAS com o botão direito do rato (e.button === 2)
  wrapper.addEventListener("mousedown", (e) => {
    if (e.button === 2) { // 2 = Botão Direito do Rato
      isDragging = true;
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      dragStartVx = vx;
      dragStartVy = vy;
      
      // Adiciona a classe visual para o cursor "grabbing"
      wrapper.classList.add("a-arrastar");
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const rect = wrapper.getBoundingClientRect();
    const deltaX = (e.clientX - dragStartClientX) * (vw / rect.width);
    const deltaY = (e.clientY - dragStartClientY) * (vh / rect.height);

    vx = dragStartVx - deltaX;
    vy = dragStartVy - deltaY;
    limitarPan();
    aplicarViewBox();
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
      isDragging = false;
      
      // Remove a classe do cursor ao soltar o botão direito
      wrapper.classList.remove("a-arrastar");
    }
  });

  // ---------- SUPORTE A GESTOS TÁTEIS (pinch-to-zoom e pan com 1 dedo) ----------
  // Usa exatamente a mesma matemática do zoom/pan de rato, só que a partir
  // da distância entre dois dedos (pinch) ou do movimento de um só dedo (pan).

  const toque = {
    modo: null,
    moveu: false,
    distanciaInicial: 0,
    zoomInicial: 1,
    vwInicial: 0,
    vhInicial: 0,
    vxInicial: 0,
    vyInicial: 0,
    midClientXInicial: 0,
    midClientYInicial: 0,
    clientXInicial: 0,
    clientYInicial: 0,
  };

  function distanciaEntreToques(t0, t1) {
    return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
  }

  function pontoMedioToques(t0, t1) {
    return {
      x: (t0.clientX + t1.clientX) / 2,
      y: (t0.clientY + t1.clientY) / 2,
    };
  }

  function iniciarPanCandidato(touch) {
    toque.modo = "pan-candidato";
    toque.moveu = false;
    toque.clientXInicial = touch.clientX;
    toque.clientYInicial = touch.clientY;
    toque.vxInicial = vx;
    toque.vyInicial = vy;
  }

  wrapper.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      toque.modo = "pinch";
      toque.distanciaInicial = distanciaEntreToques(e.touches[0], e.touches[1]);
      toque.zoomInicial = zoom;
      toque.vwInicial = vw;
      toque.vhInicial = vh;
      toque.vxInicial = vx;
      toque.vyInicial = vy;
      const meio = pontoMedioToques(e.touches[0], e.touches[1]);
      toque.midClientXInicial = meio.x;
      toque.midClientYInicial = meio.y;
    } else if (e.touches.length === 1) {
      iniciarPanCandidato(e.touches[0]);
    }
  }, { passive: false });

  wrapper.addEventListener("touchmove", (e) => {
    if (toque.modo === "pinch" && e.touches.length === 2) {
      e.preventDefault();

      const novaDistancia = distanciaEntreToques(e.touches[0], e.touches[1]);
      const factor = novaDistancia / toque.distanciaInicial;
      const novoZoom = Math.min(Math.max(1, toque.zoomInicial * factor), ZOOM_MAX);

      const rect = wrapper.getBoundingClientRect();
      const relX = (toque.midClientXInicial - rect.left) / rect.width;
      const relY = (toque.midClientYInicial - rect.top) / rect.height;
      const svgX = toque.vxInicial + relX * toque.vwInicial;
      const svgY = toque.vyInicial + relY * toque.vhInicial;

      zoom = novoZoom;
      vw = baseW / zoom;
      vh = baseH / zoom;

      if (zoom === 1) {
        vx = baseX;
        vy = baseY;
      } else {
        vx = svgX - relX * vw;
        vy = svgY - relY * vh;
        limitarPan();
      }

      aplicarViewBox();
      return;
    }

    if ((toque.modo === "pan-candidato" || toque.modo === "pan") && e.touches.length === 1) {
      const dxClient = e.touches[0].clientX - toque.clientXInicial;
      const dyClient = e.touches[0].clientY - toque.clientYInicial;

      if (!toque.moveu && Math.hypot(dxClient, dyClient) > 8) {
        toque.moveu = true;
        toque.modo = "pan";
      }

      if (toque.modo === "pan" && zoom > 1) {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const deltaX = dxClient * (vw / rect.width);
        const deltaY = dyClient * (vh / rect.height);

        vx = toque.vxInicial - deltaX;
        vy = toque.vyInicial - deltaY;
        limitarPan();
        aplicarViewBox();
      }
    }
  }, { passive: false });

  wrapper.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) {
      toque.modo = null;
    } else if (e.touches.length === 1) {
      iniciarPanCandidato(e.touches[0]);
    }
  });

  wrapper.addEventListener("touchcancel", () => {
    toque.modo = null;
  });

  window.addEventListener("resize", () => {
    ({ zoom, vw, vh, vx, vy } = estadoInicial());
    aplicarViewBox();
  });

  aplicarViewBox();
}

// Lightbox (Imagens dos concelhos no painel de ajuda)

// VARIÁVEIS DE CONTROLO DA LIGHTBOX
let imagensLightboxAtuais = [];
let indiceImagemAtual = 0;

// Abrir Lightbox num determinado índice
function abrirLightbox(listaImagens, indiceInicial) {
  imagensLightboxAtuais = listaImagens;
  indiceImagemAtual = indiceInicial;
  
  atualizarImagemLightbox();
  lightboxModal.classList.remove("escondido");
}

// Atualizar imagem visível
function atualizarImagemLightbox() {
  lightboxImagem.src = imagensLightboxAtuais[indiceImagemAtual];
}

// Navegação entre imagens
function imagemAnterior() {
  indiceImagemAtual = (indiceImagemAtual - 1 + imagensLightboxAtuais.length) % imagensLightboxAtuais.length;
  atualizarImagemLightbox();
}

function imagemSeguinte() {
  indiceImagemAtual = (indiceImagemAtual + 1) % imagensLightboxAtuais.length;
  atualizarImagemLightbox();
}

// Eventos de clique nas setas e fechar
btnAnteriorLightbox.addEventListener("click", (e) => {
  e.stopPropagation();
  imagemAnterior();
});

btnSeguinteLightbox.addEventListener("click", (e) => {
  e.stopPropagation();
  imagemSeguinte();
});

btnFecharLightbox.addEventListener("click", () => {
  lightboxModal.classList.add("escondido");
});

// Fechar ao clicar fora da imagem e das setas
lightboxModal.addEventListener("click", (e) => {
  if (e.target === lightboxModal || e.target.classList.contains("lightbox-conteudo")) {
    lightboxModal.classList.add("escondido");
  }
});

// Atalhos de teclado (Setas e Escape)
document.addEventListener("keydown", (e) => {
  if (lightboxModal.classList.contains("escondido")) return;
  
  if (e.key === "Escape") lightboxModal.classList.add("escondido");
  if (e.key === "ArrowLeft") imagemAnterior();
  if (e.key === "ArrowRight") imagemSeguinte();
});