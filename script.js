import { map_distrito_concelhos } from './concelhos_map.js';
import { dadosConcelhos } from './info_concelhos.js';

// Lista completa dos 308 concelhos
// para debug num distrito usar isto: 
// map_distrito_concelhos.get('Santarém') || []; //
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

// Elementos Fim de Jogo
const painelTopRight = document.querySelector(".painel-top-right");
const painelFimJogo = document.getElementById("painel-fim-jogo");
const elFimPontuacao = document.getElementById("fim-pontuacao");
const elFimTempo = document.getElementById("fim-tempo");
const elFimTentativas = document.getElementById("fim-tentativas");
const elListaDistritos = document.getElementById("lista-distritos-resumo");
const btnReiniciar = document.getElementById("btn-reiniciar");

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

  btnIniciar.addEventListener("click", () => {
    menuInicial.classList.add("escondido");
    iniciarJogoDirecto();
  });

  // INÍCIO: EVENTO DE REINICIAR (RELOAD DA PÁGINA)
  btnReiniciar.addEventListener("click", () => {
    window.location.reload();
  });
// FIM: EVENTO DE REINICIAR (RELOAD DA PÁGINA)
});

function iniciarJogoDirecto() {
  concelhosRestantes = [...listaConcelhos];
  pontuacao = 0;
  tentativasTotais = 0;
  tempoSegundos = 0;
  
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
  elPontuacao.textContent = `${pontuacao}/308`;
  elTentativas.textContent = tentativasTotais;
}

// INÍCIO: REGISTO DE ACERTOS NO CLIQUE
document.querySelectorAll("svg path[data-concelho]").forEach(path => {
  path.addEventListener("click", (e) => {
    if (e.button !== 0 || !concelhoAtual) return;

    const elClicado = e.target;

    // Ignora cliques em concelhos já respondidos (acertados ou passados à
    // frente): não deve contar como tentativa nem interferir com o som
    // que estiver a tocar.
    if (
      elClicado.classList.contains("correto") ||
      elClicado.classList.contains("com-erros") ||
      elClicado.classList.contains("pular")
    ) {
      return;
    }

    const concelhoClicado = elClicado.getAttribute("data-concelho");
    tentativasTotais++;
    elTentativas.textContent = tentativasTotais;

    if (concelhoClicado === concelhoAtual) {
      fecharPainelAjuda();
      tocarSom(somAcerto, 2000);
      
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
    const jaFoiSelecionado = el.classList.contains("correto") || 
                             el.classList.contains("com-erros") || 
                             el.classList.contains("pular");

    if (jaFoiSelecionado && elTooltip) {
      elTooltip.textContent = el.getAttribute("data-concelho");
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

// INÍCIO: FINALIZAR JOGO E RESUMO ORDENADO POR PERCENTAGEM
function finalizarJogo() {
  clearInterval(intervaloTimer);
  fecharPainelAjuda();
  
  // Oculta o HUD da direita e mostra o painel de resumo
  painelTopRight.classList.add("escondido");
  painelFimJogo.classList.remove("escondido");

  elFimPontuacao.textContent = `${pontuacao}/308 - ${Math.round((pontuacao / 308) * 100)}%`;
  elFimTempo.textContent = elTimer.textContent;
  elFimTentativas.textContent = tentativasTotais;

  // Limpa a lista
  elListaDistritos.innerHTML = "";
  
  // 1. Mapeia os dados de cada distrito para um array com a percentagem calculada
  const resumoDistritos = Array.from(map_distrito_concelhos.entries()).map(([distrito, concelhos]) => {
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
}

// INÍCIO: GESTÃO DO PAINEL DE AJUDA / PISTAS
btnAjuda.addEventListener("click", async () => {
  if (!concelhoAtual) return;

  errosNoConcelhoAtual++;

  modalTitulo.textContent = concelhoAtual;
  modalImagem.classList.add("escondido");
  modalImagem.src = "";

  const extensoes = [".png", ".webp", ".jfif", ".gif", ".jpg", ".jpeg"];
  let imagemEncontrada = null;

  // Percorre as extensões e verifica qual existe no servidor/servidor local
  for (const ext of extensoes) {
    const caminho = `./images/Heráldicas Municipais/${encodeURIComponent(concelhoAtual)}${ext}`;
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

  // Se encontrou a extensão correta, exibe-a
  if (imagemEncontrada) {
    modalImagem.src = imagemEncontrada;
    modalImagem.classList.remove("escondido");
  }

  const dados = dadosConcelhos[concelhoAtual];

  if (dados) {
    let htmlGaleria = "";

    if (dados.imagens && dados.imagens.length > 0) {
      htmlGaleria = `<div class="galeria-concelho">`;
      dados.imagens.forEach((imgUrl, idx) => {
        htmlGaleria += `<img src="${imgUrl}" class="galeria-miniatura" data-index="${idx}" alt="Fotografia de ${concelhoAtual}">`;
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
    modalDescricao.innerHTML = `<p>Informações e pistas sobre o concelho de <strong>${concelhoAtual}</strong> estarão disponíveis brevemente.</p>`;
  }

  modalInfo.classList.remove("escondido");
  if (painelTopRight) {
    painelTopRight.classList.add("escondido");
  }
});

function fecharPainelAjuda() {
  if (modalInfo) modalInfo.classList.add("escondido");
  if (modalImagem) {
    modalImagem.src = "";
    modalImagem.classList.add("escondido");
  }
  if (painelTopRight) {
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