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

// Elementos da Interface (HUD)
const elNomeConcelho = document.getElementById("nome-concelho");
const elPontuacao = document.getElementById("pontuacao");
const elTentativas = document.getElementById("tentativas");
const elTimer = document.getElementById("timer");
const btnSkip = document.getElementById("btn-skip");

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

// Clique com Botão Esquerdo nos Concelhos
document.querySelectorAll("svg path[data-concelho]").forEach(path => {
  path.addEventListener("click", (e) => {
    if (e.button !== 0 || !concelhoAtual) return;
    
    const concelhoClicado = e.target.getAttribute("data-concelho");
    tentativasTotais++;
    elTentativas.textContent = tentativasTotais;

    if (concelhoClicado === concelhoAtual || concelhoClicado.startsWith(concelhoAtual)) {
      pontuacao++;
      
      if (errosNoConcelhoAtual === 0) {
        pintarConcelho(concelhoClicado, "correto");
      } else {
        pintarConcelho(concelhoClicado, "com-erros");
      }
      
      processarFimDeJogada();
    } else {
      errosNoConcelhoAtual++;
    }
  });
});

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
  const viewport = document.getElementById("mapa-viewport");
  
  let scale = 1;
  let pointX = 0;
  let pointY = 0;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  function updateTransform() {
    viewport.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
  }

  // Zoom no ponto EXATO do cursor
  wrapper.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(Math.max(1, scale * factor), 4);

    // Se voltar ao zoom base (1), recentra automaticamente o mapa
    if (newScale === 1) {
      pointX = 0;
      pointY = 0;
    } else {
      pointX = clientX - (clientX - pointX) * (newScale / scale);
      pointY = clientY - (clientY - pointY) * (newScale / scale);
    }

    scale = newScale;
    updateTransform();
  });

  // Arrasto permitido APENAS se houver zoom ativo (scale > 1)
  wrapper.addEventListener("mousedown", (e) => {
    if (e.button === 2 && scale > 1) {
      isDragging = true;
      startX = e.clientX - pointX;
      startY = e.clientY - pointY;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    pointX = e.clientX - startX;
    pointY = e.clientY - startY;
    updateTransform();
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
      isDragging = false;
    }
  });

  // Recentra o mapa limparmente ao redimensionar ou minimizar a janela
  window.addEventListener("resize", () => {
    scale = 1;
    pointX = 0;
    pointY = 0;
    updateTransform();
  });
}