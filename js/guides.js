// Fotos do protocolo e suas linhas-guia (coordenadas em % do quadro, 0-100).
// As linhas são referências gerais de enquadramento, não medidas anatômicas exatas.
const L = (x1, y1, x2, y2, cls = "g-line") => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
const E = (cx, cy, rx, ry, cls = "g-thin") => `<ellipse class="${cls}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const R = (x, y, w, h, cls = "g-zone") => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`;
const thirds = (cls = "g-thin") => L(33.3, 0, 33.3, 100, cls) + L(66.6, 0, 66.6, 100, cls) + L(0, 33.3, 100, 33.3, cls) + L(0, 66.6, 100, 66.6, cls);

export const GUIAS = [
  {
    id: "face-repouso", nome: "Frontal em repouso", curto: "Frontal repouso", orient: "port",
    svg: E(50, 47, 30, 38) + L(50, 0, 50, 100) + L(0, 38, 100, 38) + L(0, 62, 100, 62, "g-thin"),
    dica: [
      "Cabeça reta, olhar no horizonte (plano de Frankfurt paralelo ao solo).",
      "Lábios em repouso, sem contrair o mento.",
      "Linha vertical sobre o meio da face; linha horizontal na altura dos olhos.",
      "Câmera na altura dos olhos do paciente, a cerca de 1 m.",
    ],
  },
  {
    id: "face-sorriso", nome: "Frontal sorrindo", curto: "Frontal sorrindo", orient: "port",
    svg: E(50, 47, 30, 38) + L(50, 0, 50, 100) + L(0, 38, 100, 38) + R(28, 58, 44, 14),
    dica: [
      "Mesmo enquadramento da frontal em repouso, para poder comparar as duas.",
      "Peça um sorriso amplo e natural; o retângulo marca onde o sorriso deve ficar.",
      "Linha vertical sobre o meio da face. Cabeça reta, sem inclinar.",
    ],
  },
  {
    id: "labio-repouso", nome: "Frontal lábios em repouso", curto: "Lábios em repouso", orient: "land",
    svg: R(18, 28, 64, 44) + L(50, 0, 50, 100) + L(0, 50, 100, 50, "g-thin"),
    dica: [
      "Aproximação dos lábios e do terço inferior da face, em repouso, sem contrair.",
      "Linha média da face sobre a linha vertical; comissuras na horizontal.",
      "Se possível, mostre quanto do incisivo superior aparece com o lábio relaxado.",
      "Mesma distância e luz das outras fotos extraorais.",
    ],
  },
  {
    id: "perfil-repouso", nome: "Perfil em repouso", curto: "Perfil repouso", orient: "port",
    svg: E(50, 47, 24, 38) + L(50, 0, 50, 100, "g-thin") + L(0, 44, 100, 44) + L(0, 62, 100, 62, "g-thin"),
    dica: [
      "Paciente de lado (perfil de 90°), cabeça reta e olhar no horizonte.",
      "Linha horizontal na altura do plano de Frankfurt (do tragus à base da órbita).",
      "Lábios em repouso, cabelo preso para mostrar a orelha.",
      "Câmera perpendicular ao perfil, na altura dos olhos, a cerca de 1 m.",
    ],
  },
  {
    id: "perfil-sorriso", nome: "Perfil sorrindo", curto: "Perfil sorrindo", orient: "port",
    svg: E(50, 47, 24, 38) + L(50, 0, 50, 100, "g-thin") + L(0, 44, 100, 44) + R(30, 56, 30, 14),
    dica: [
      "Mesmo enquadramento do perfil em repouso, para poder comparar.",
      "Peça um sorriso amplo e natural, mantendo a cabeça na mesma posição.",
      "Linha horizontal no plano de Frankfurt.",
    ],
  },
  {
    id: "intra-frontal", nome: "Intraoral frontal", curto: "Intraoral frontal", orient: "land",
    svg: R(8, 24, 84, 52) + L(50, 0, 50, 100) + L(0, 50, 100, 50) + E(50, 50, 40, 22),
    dica: [
      "Dentes em oclusão, com afastadores labiais sem tensionar.",
      "Linha média dental sobre a linha vertical; plano oclusal horizontal.",
      "Mostrar de pré-molar a pré-molar, sem lábio ou língua cobrindo os dentes.",
      "Foco nos incisivos centrais. Seque a superfície para reduzir reflexos.",
    ],
  },
  {
    id: "lateral-esq", nome: "Lateral esquerda", curto: "Lateral esquerda", orient: "land",
    svg: L(50, 0, 50, 100) + L(0, 50, 100, 50) + R(6, 26, 88, 48),
    dica: [
      "Espelho lateral e afastador; centro da foto no canino.",
      "Plano oclusal na horizontal.",
      "Mostrar do canino ao último molar visível, em oclusão.",
      "Mantenha a mesma distância da lateral direita para poder comparar.",
    ],
  },
  {
    id: "lateral-dir", nome: "Lateral direita", curto: "Lateral direita", orient: "land",
    svg: L(50, 0, 50, 100) + L(0, 50, 100, 50) + R(6, 26, 88, 48),
    dica: [
      "Espelho lateral e afastador; centro da foto no canino.",
      "Plano oclusal na horizontal.",
      "Mostrar do canino ao último molar visível, em oclusão.",
      "Evite embaçar o espelho: aqueça em água morna ou use ar.",
    ],
  },
];
