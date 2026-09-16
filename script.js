import { map_distrito_concelhos } from './concelhos_map.js';

// Lista completa dos 308 concelhos
const listaConcelhos = Array.from(map_distrito_concelhos.values()).flatMap(lista => lista);

let concelhosRestantes = [];
let concelhoAtual = null;
let pontuacao = 0;
let errosNoConcelhoAtual = 0;
let tentativasTotais = 0;
let tempoSegundos = 0;
let intervaloTimer = null;

// Efeitos Sonoros
const somAcerto = new Audio('./sounds/correct.mp3');
const somErro = new Audio('./sounds/wrong.mp3');

// Ajustar o Volume (0.0 a 1.0)
somAcerto.volume = 0.6; // 60% do volume
somErro.volume = 0.25;   // 40% do volume;

/**
 * Função para tocar áudio com suporte a corte de som antigo e duração limite
 * @param {HTMLAudioElement} audio - O elemento de áudio a tocar
 * @param {number|null} duracaoMs - Duração máxima em milissegundos (opcional)
 */
function tocarSom(audio, duracaoMs = null) {
  // 1. Interrompe o som se já estiver a tocar e volta ao início
  audio.pause();
  audio.currentTime = 0;

  // 2. Toca o som a partir do início
  audio.play().catch(() => {
    // Evita erros de política de auto-play do browser
  });

  // 3. Corta o som após o tempo definido (se fornecido)
  if (duracaoMs) {
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, duracaoMs);
  }
}

// INÍCIO: DECLARAÇÃO DE ELEMENTOS (HUD & TOOLTIP)
const elNomeConcelho = document.getElementById("nome-concelho");
const elPontuacao = document.getElementById("pontuacao");
const elTentativas = document.getElementById("tentativas");
const elTimer = document.getElementById("timer");
const btnSkip = document.getElementById("btn-skip");
const elTooltip = document.getElementById("tooltip-concelho");
// FIM: DECLARAÇÃO DE ELEMENTOS (HUD & TOOLTIP)

window.addEventListener("DOMContentLoaded", () => {
  window.addEventListener("contextmenu", (e) => e.preventDefault());
  iniciarJogoDirecto();
  configurarZoomEPan();
});

function iniciarJogoDirecto() {
  concelhosRestantes = [...listaConcelhos];
  pontuacao = 0;
  tentativasTotais = 0;
  tempoSegundos = 0;
  
  iniciarTimer();
  proximoConcelho();
}

function proximoConcelho() {
  // Se a lista estiver vazia, marca que já não há concelho ativo
  if (concelhosRestantes.length === 0) {
    concelhoAtual = null;
    return;
  }
  
  errosNoConcelhoAtual = 0;
  
  const indiceAleatorio = Math.floor(Math.random() * concelhosRestantes.length);
  concelhoAtual = concelhosRestantes.splice(indiceAleatorio, 1)[0];
  
  elNomeConcelho.textContent = concelhoAtual;
  elPontuacao.textContent = `${pontuacao}/308`;
  elTentativas.textContent = tentativasTotais;
}

// INÍCIO: EVENTOS DOS CONCELHOS (CLIQUE E HOVER SELECCIONADOS)
document.querySelectorAll("svg path[data-concelho]").forEach(path => {
  // Evento de Clique
  path.addEventListener("click", (e) => {
    if (e.button !== 0 || !concelhoAtual) return;
    
    const concelhoClicado = e.target.getAttribute("data-concelho");
    tentativasTotais++;
    elTentativas.textContent = tentativasTotais;

    if (concelhoClicado === concelhoAtual) {
      tocarSom(somAcerto, 2000);
      pontuacao++;
      
      if (errosNoConcelhoAtual === 0) {
        pintarConcelho(concelhoClicado, "correto");
      } else {
        pintarConcelho(concelhoClicado, "com-erros");
      }
      
      processarFimDeJogada();
    } else {
      tocarSom(somErro, 2000);
      errosNoConcelhoAtual++;
    }
  });

  // Mostrar caixa de texto apenas em concelhos já selecionados
  path.addEventListener("mouseenter", (e) => {
    const el = e.target;
    const jaFoiSelecionado = el.classList.contains("correto") || 
                             el.classList.contains("com-erros") || 
                             el.classList.contains("pular");

    if (jaFoiSelecionado) {
      const nomeConcelho = el.getAttribute("data-concelho");
      if (elTooltip) {
        elTooltip.textContent = nomeConcelho;
        elTooltip.classList.add("ativo");
      }
    }
  });

  // Esconder a caixa ao sair do concelho
  path.addEventListener("mouseleave", () => {
    if (elTooltip) {
      elTooltip.classList.remove("ativo");
    }
  });
});
// FIM: EVENTOS DOS CONCELHOS (CLIQUE E HOVER SELECCIONADOS)

// Botão Passar à Frente -> Vermelho
btnSkip.addEventListener("click", () => {
  if (!concelhoAtual) return;
  
  pintarConcelho(concelhoAtual, "pular");
  processarFimDeJogada();
});

// Função central para avançar ou terminar o jogo
function processarFimDeJogada() {
  proximoConcelho();

  // Avalia se a lista esgotou DEPOIS de processar a jogada atual
  if (!concelhoAtual) {
    elPontuacao.textContent = `${pontuacao}/308`;
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

function finalizarJogo() {
  clearInterval(intervaloTimer);
  setTimeout(() => {
    alert(`Jogo Concluído!\nPontuação: ${pontuacao}/308\nTentativas: ${tentativasTotais}\nTempo: ${elTimer.textContent}`);
  }, 100);
}

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
    vx = Math.min(Math.max(vx, baseX), baseX + baseW - vw);
    vy = Math.min(Math.max(vy, baseY), baseY + baseH - vh);
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

  // Arrasto permitido APENAS se houver zoom ativo (zoom > 1)
  wrapper.addEventListener("mousedown", (e) => {
    if (e.button === 2 && zoom > 1) {
      isDragging = true;
      dragStartClientX = e.clientX;
      dragStartClientY = e.clientY;
      dragStartVx = vx;
      dragStartVy = vy;
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
    }
  });

  // Recentra o mapa limparmente ao redimensionar ou minimizar a janela
  window.addEventListener("resize", () => {
    zoom = 1;
    vx = baseX;
    vy = baseY;
    vw = baseW;
    vh = baseH;
    aplicarViewBox();
  });

  aplicarViewBox();
}