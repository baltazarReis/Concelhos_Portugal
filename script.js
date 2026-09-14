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
  if (concelhosRestantes.length === 0) {
    finalizarJogo();
    return;
  }
  
  errosNoConcelhoAtual = 0; // Reseta os erros para o novo concelho
  
  const indiceAleatorio = Math.floor(Math.random() * concelhosRestantes.length);
  concelhoAtual = concelhosRestantes.splice(indiceAleatorio, 1)[0];
  
  elNomeConcelho.textContent = concelhoAtual;
  elPontuacao.textContent = `${pontuacao}/308`;
  elTentativas.textContent = tentativasTotais;
}

// Clique com Botão Esquerdo nos Concelhos
document.querySelectorAll("svg path[data-concelho]").forEach(path => {
  path.addEventListener("click", (e) => {
    // Garante que só responde ao botão esquerdo (button 0)
    if (e.button !== 0 || !concelhoAtual) return;
    
    const concelhoClicado = e.target.getAttribute("data-concelho");
    tentativasTotais++;
    elTentativas.textContent = tentativasTotais;

    if (concelhoClicado === concelhoAtual) {
      pontuacao++;
      
      if (errosNoConcelhoAtual === 0) {
        // Acertou à primeira -> Verde
        pintarConcelho(concelhoAtual, "correto");
      } else {
        // Acertou após ter falhado -> Laranja
        pintarConcelho(concelhoAtual, "com-erros");
      }
      
      proximoConcelho();
    } else {
      // Errou -> Incrementa contagem de erros sem mudar a cor do mapa
      errosNoConcelhoAtual++;
    }
  });
});

// Botão Passar à Frente -> Vermelho
btnSkip.addEventListener("click", () => {
  if (!concelhoAtual) return;
  
  pintarConcelho(concelhoAtual, "pular");
  proximoConcelho();
});

// Função para pintar o concelho e limpar o atributo style inline
function pintarConcelho(nomeConcelho, classeCSS) {
  const elementos = document.querySelectorAll(`svg path[data-concelho="${nomeConcelho}"]`);
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
  alert(`Jogo Concluído!\nPontuação: ${pontuacao}/308\nTentativas: ${tentativasTotais}\nTempo: ${elTimer.textContent}`);
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

  // Bloquear menu de contexto do botão direito
  wrapper.addEventListener("contextmenu", (e) => e.preventDefault());

  // No updateTransform deixa apenas a transformação limpa:
function updateTransform() {
  viewport.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
}

// No evento mousemove aplica o limite apenas ao arrastar:
window.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  pointX = e.clientX - startX;
  pointY = e.clientY - startY;
  
  limitarLimites(); // Limita o arrasto manual sem estragar o zoom no cursor
  updateTransform();
});

  // Zoom no ponto EXATO do cursor
  wrapper.addEventListener("wheel", (e) => {
    e.preventDefault();

    const rect = wrapper.getBoundingClientRect();
    // Posição real do cursor relativa ao canto superior esquerdo do mapa
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Fator de escala
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.15 : 1 / 1.15;
    const newScale = Math.min(Math.max(1, scale * factor), 15);

    // Ajusta o desfasamento para prender o ponto sob o rato
    pointX = clientX - (clientX - pointX) * (newScale / scale);
    pointY = clientY - (clientY - pointY) * (newScale / scale);
    scale = newScale;

    updateTransform();
  });

  // Arrasto com o Botão Direito
  wrapper.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
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
}