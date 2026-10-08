// Modelo 3D em vista explodida do redutor coroa e rosca sem fim WEG-Cestari WCR28.
// As peças são desenhadas por código (Three.js), em milímetros aproximados:
// eixo de saída na direção Z, rosca sem fim na direção X, 28 mm abaixo do centro da coroa.
// A disposição da vista explodida segue a figura "Peças de um redutor" usada como referência.
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

// Peças com número de balão e ficha: tipo, material, quantidade, especificação típica,
// função, o que inspecionar e falhas comuns. "interna" = fica dentro da carcaça.
// As especificações são as usuais para redutores deste porte; o código exato de cada
// peça de reposição deve ser conferido na própria peça ou na lista de peças do fabricante.
export const PECAS = [
  { id: "carcaca", nome: "Carcaça", tipo: "Carcaça monobloco com base de fixação (pés)",
    material: "Ferro fundido cinzento, pintado (confirmar no catálogo do tamanho 28)", qtd: "1",
    espec: "Furos usinados para os mancais da coroa (eixo de saída) e da rosca sem fim, a 28 mm de distância entre centros.",
    funcao: "Aloja e alinha os eixos, guarda o óleo e dissipa o calor.",
    inspecao: "Trincas, aquecimento, vazamentos e fixação na base.",
    falhas: "Trinca por sobrecarga ou aperto irregular da base; pintura queimada por superaquecimento." },
  { id: "respiro", nome: "Respiro", tipo: "Bujão respiro (com furo de alívio e filtro)",
    material: "Latão ou plástico técnico", qtd: "1",
    espec: "Rosca igual à do furo superior da carcaça; montado sempre na posição mais alta.",
    funcao: "Equaliza a pressão interna quando o óleo aquece, evitando que ele seja empurrado pelos retentores.",
    inspecao: "Deve estar limpo e desobstruído.",
    falhas: "Entupido por poeira ou tinta, fazendo o óleo vazar pelos retentores." },
  { id: "bujoes", nome: "Bujões de nível e dreno", tipo: "Bujão sextavado com rosca e arruela de vedação",
    material: "Aço zincado; arruela de cobre, alumínio ou fibra", qtd: "2 (posição ilustrativa)",
    espec: "A posição varia com a forma de montagem (M1 a M6). Confirmar no redutor instalado.",
    funcao: "Conferir o nível (bujão de nível) e escoar o óleo usado (bujão de dreno).",
    inspecao: "Sem vazamento; usar para conferir o nível e coletar amostra.",
    falhas: "Arruela de vedação reutilizada ou rosca espanada por aperto excessivo." },
  { id: "coroa", nome: "Coroa (bronze)", tipo: "Coroa para rosca sem fim (engrenagem helicoidal côncava)",
    material: "Aro de bronze (liga cobre-estanho) com cubo de aço", qtd: "1", interna: true,
    espec: "30 dentes. Com a rosca de 4 entradas: 30 ÷ 4 = redução 1:7,5. Fixada no eixo de saída por chaveta.",
    funcao: "Engrenagem movida: recebe o movimento da rosca sem fim e gira o eixo de saída 7,5 vezes mais devagar.",
    inspecao: "Desgaste, pitting e partículas de bronze no óleo.",
    falhas: "Desgaste por óleo errado ou degradado, pitting (pequenas crateras) por sobrecarga, dente quebrado por choque." },
  { id: "eixo-saida", nome: "Eixo de saída Ø 14 mm", tipo: "Eixo maciço com rasgo de chaveta",
    material: "Aço carbono (ex.: SAE 1045)", qtd: "1", interna: true,
    espec: "Ponta Ø 14 mm para acoplar a máquina; apoiado em dois rolamentos.",
    funcao: "Transmite o movimento reduzido (1:7,5) e o torque à máquina.",
    inspecao: "Folga axial e radial, riscos na pista do retentor.",
    falhas: "Pista do retentor riscada (vazamento), rasgo de chaveta deformado, empeno por esforço radial excessivo." },
  { id: "chavetas", nome: "Chavetas", tipo: "Chaveta paralela DIN 6885 forma A",
    material: "Aço carbono trefilado (ex.: C45)", qtd: "3", interna: true,
    espec: "Eixo Ø 14 mm (coroa e ponta de saída): 5 × 5 mm. Eixo Ø 11 mm (entrada): 4 × 4 mm.",
    funcao: "Travam a coroa no eixo e os acoplamentos nas pontas dos eixos, transmitindo o torque.",
    inspecao: "Folga ou marcas de cisalhamento.",
    falhas: "Folga no rasgo (batida na partida), chaveta cisalhada por travamento." },
  { id: "rolamentos-saida", nome: "Rolamentos do eixo de saída", tipo: "Rolamento rígido de esferas, uma carreira",
    material: "Aço cromo para rolamentos, gaiola de aço", qtd: "2", interna: true,
    espec: "A designação (ex.: série 62xx) está gravada no anel externo; anotar antes de comprar a reposição.",
    funcao: "Apoiam o eixo de saída nos dois lados da carcaça e suportam as cargas radiais e axiais da coroa.",
    inspecao: "Ruído, aquecimento localizado e folga.",
    falhas: "Ruído áspero por contaminação ou falta de óleo, folga interna, pista marcada por montagem com martelo." },
  { id: "juntas", nome: "Juntas (anéis O) das tampas", tipo: "Anel O-ring (anel de vedação estático)",
    material: "Borracha nitrílica (NBR)", qtd: "4",
    espec: "Medida = diâmetro interno × espessura do cordão. Trocar sempre que a tampa for aberta.",
    funcao: "Vedam o encosto das tampas na carcaça.",
    inspecao: "Marcas de óleo em volta das tampas.",
    falhas: "Ressecado, cortado na montagem ou esmagado por aperto desigual dos parafusos." },
  { id: "tampas-saida", nome: "Tampas do eixo de saída", tipo: "Tampa flangeada (com furo para o eixo) e tampa cega",
    material: "Ferro fundido ou alumínio, pintadas", qtd: "2",
    espec: "Encaixe (rebaixo) centraliza a tampa no furo da carcaça; a tampa com furo aloja o retentor.",
    funcao: "Fecham a carcaça e posicionam axialmente os rolamentos da coroa.",
    inspecao: "Aperto dos parafusos e vazamento.",
    falhas: "Vazamento por junta danificada ou parafusos frouxos." },
  { id: "rosca", nome: "Rosca sem fim / eixo de entrada Ø 11 mm", tipo: "Rosca sem fim de 4 entradas, integrada ao eixo de entrada",
    material: "Aço liga cementado, temperado e retificado (ex.: SAE 8620)", qtd: "1", interna: true,
    espec: "Ponta de entrada maciça Ø 11 mm com chaveta 4 × 4, para motor de até 0,77 cv.",
    funcao: "Recebe o giro do motor e aciona a coroa; 1 volta da rosca avança 4 dentes da coroa.",
    inspecao: "Desgaste dos filetes, folga e giro suave.",
    falhas: "Filetes riscados ou desgastados por óleo contaminado; aquecimento por atrito excessivo." },
  { id: "rolamentos-entrada", nome: "Rolamentos da rosca sem fim", tipo: "Rolamento rígido de esferas (ou de contato angular)",
    material: "Aço cromo para rolamentos", qtd: "2", interna: true,
    espec: "Suportam o empuxo axial gerado pela rosca. Designação gravada no anel externo.",
    funcao: "Apoiam a rosca sem fim e absorvem o esforço axial.",
    inspecao: "Ruído, aquecimento localizado e folga.",
    falhas: "Desgaste pelo empuxo axial, contaminação e falta de lubrificação." },
  { id: "tampas-entrada", nome: "Tampas da rosca sem fim", tipo: "Tampa com furo para o eixo de entrada e tampa cega",
    material: "Ferro fundido ou alumínio, pintadas", qtd: "2",
    espec: "A tampa com furo aloja o retentor do eixo de entrada.",
    funcao: "Fecham a carcaça e posicionam os rolamentos da rosca.",
    inspecao: "Aperto dos parafusos e vazamento.",
    falhas: "Vazamento por junta danificada ou parafusos frouxos." },
  { id: "retentores", nome: "Retentores dos eixos", tipo: "Retentor radial de lábio com mola (DIN 3760)",
    material: "Borracha nitrílica (NBR) com armação de aço", qtd: "2",
    espec: "Um para o eixo de saída (Ø 14 mm) e um para o de entrada (Ø 11 mm). Medida gravada: eixo × alojamento × largura.",
    funcao: "Vedam a passagem dos eixos girantes, segurando o óleo e barrando poeira e água.",
    inspecao: "Vazamento e lábio ressecado ou cortado.",
    falhas: "Lábio ressecado por calor, cortado na montagem ou gasto pelo eixo riscado." },
  { id: "parafusos", nome: "Parafusos e arruelas", tipo: "Parafuso cabeça cilíndrica com sextavado interno (Allen) ISO 4762 + arruela",
    material: "Aço classe 8.8, zincado", qtd: "16 (4 por tampa)",
    espec: "Apertar em cruz, com torque uniforme, para não deformar a tampa nem esmagar a junta.",
    funcao: "Fixam as tampas na carcaça.",
    inspecao: "Aperto e corrosão.",
    falhas: "Afrouxamento por vibração, rosca espanada por aperto excessivo." }
];

const PI = Math.PI;

function materiais() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  return {
    verde: m({ color: 0x4fae45, roughness: 0.55, metalness: 0.1 }),
    furo: m({ color: 0x14240f, roughness: 1, metalness: 0 }),
    aco: m({ color: 0xc3c9cf, roughness: 0.28, metalness: 0.85 }),
    acoEscuro: m({ color: 0x6d757d, roughness: 0.4, metalness: 0.8 }),
    bronze: m({ color: 0xd8915e, roughness: 0.38, metalness: 0.55 }),
    borracha: m({ color: 0x1f2124, roughness: 0.85, metalness: 0 }),
    parafuso: m({ color: 0x2c3035, roughness: 0.45, metalness: 0.6 }),
    laranja: m({ color: 0xe8a317, roughness: 0.5, metalness: 0.1 })
  };
}

// Anel (ou disco, se rIn = 0) com eixo em Y, centrado na origem.
function anel(rOut, rIn, largura, segmentos) {
  const h = largura / 2;
  const pts = rIn > 0
    ? [[rIn, -h], [rOut, -h], [rOut, h], [rIn, h], [rIn, -h]]
    : [[0, -h], [rOut, -h], [rOut, h], [0, h]];
  return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), segmentos || 48);
}

// Gira uma geometria com eixo em Y para o eixo pedido.
function noEixo(geo, eixo) {
  if (eixo === "x") geo.rotateZ(-PI / 2);
  if (eixo === "z") geo.rotateX(PI / 2);
  return geo;
}

function malha(geo, mat, x, y, z) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x || 0, y || 0, z || 0);
  return o;
}

// ---------- peças ----------

function carcaca(M) {
  const g = new THREE.Group();
  // perfil frontal com o furo da coroa, extrudado na direção Z
  const w = 40, yb = -44, yt = 38, r = 7;
  const s = new THREE.Shape();
  s.moveTo(-w + r, yb); s.lineTo(w - r, yb); s.quadraticCurveTo(w, yb, w, yb + r);
  s.lineTo(w, yt - r); s.quadraticCurveTo(w, yt, w - r, yt);
  s.lineTo(-w + r, yt); s.quadraticCurveTo(-w, yt, -w, yt - r);
  s.lineTo(-w, yb + r); s.quadraticCurveTo(-w, yb, -w + r, yb);
  const furo = new THREE.Path(); furo.absarc(0, 0, 21, 0, 2 * PI, true); s.holes.push(furo);
  const corpo = new THREE.ExtrudeGeometry(s, { depth: 52, bevelEnabled: true, bevelThickness: 1.5,
    bevelSize: 1.5, bevelSegments: 2, curveSegments: 32 });
  corpo.translate(0, 0, -26);
  g.add(malha(corpo, M.verde));
  // ressaltos dos mancais da coroa (frente e trás)
  [1, -1].forEach((l) => {
    g.add(malha(noEixo(anel(31, 21, 4), "z"), M.verde, 0, 0, l * 29));
  });
  // ressaltos e furos da rosca sem fim (laterais), 28 mm abaixo do centro
  [1, -1].forEach((l) => {
    g.add(malha(noEixo(anel(20, 16, 6), "x"), M.verde, l * 43, -28, 0));
    g.add(malha(noEixo(anel(16, 0, 0.6), "x"), M.furo, l * 44.5, -28, 0));
  });
  // interior escuro visto pelo furo da coroa
  g.add(malha(noEixo(anel(20.8, 0, 0.6), "z"), M.furo, 0, 0, 0));
  // base com abas de fixação
  g.add(malha(new THREE.BoxGeometry(100, 7, 62), M.verde, 0, -48, 0));
  [-42, 42].forEach((x) => [-22, 22].forEach((z) => {
    g.add(malha(noEixo(anel(4.5, 0, 0.6), "y"), M.furo, x, -44.2, z));
  }));
  // tampo superior com dois rasgos
  g.add(malha(new THREE.BoxGeometry(70, 5, 50), M.verde, 0, 41, 0));
  [-16, 16].forEach((x) => g.add(malha(new THREE.BoxGeometry(4, 0.6, 50.4), M.furo, x, 43.6, 0)));
  // furos roscados do tampo e furo do respiro
  g.add(malha(anel(4, 0, 0.6), M.furo, 0, 43.6, 0));
  [[-28, -18], [28, -18], [-28, 18], [28, 18]].forEach((p) =>
    g.add(malha(anel(2.2, 0, 0.6), M.furo, p[0], 43.6, p[1])));
  // furos roscados das tampas da coroa
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2;
    [1, -1].forEach((l) => g.add(malha(noEixo(anel(2, 0, 0.6), "z"), M.furo,
      27 * Math.cos(a), 27 * Math.sin(a), l * 31.2)));
  }
  return g;
}

function respiro(M) {
  const g = new THREE.Group();
  g.add(malha(new THREE.CylinderGeometry(5, 5, 4, 6), M.laranja, 0, 0, 0));
  g.add(malha(new THREE.CylinderGeometry(4.2, 4.6, 7, 24), M.laranja, 0, 5.5, 0));
  g.add(malha(new THREE.CylinderGeometry(2.6, 2.6, 7, 16), M.acoEscuro, 0, -5, 0));
  return g;
}

function bujao(M, eixo) {
  const g = new THREE.Group();
  g.add(malha(noEixo(new THREE.CylinderGeometry(4.2, 4.2, 3.5, 6), eixo), M.parafuso));
  const rosca = noEixo(new THREE.CylinderGeometry(3, 3, 6, 16), eixo);
  rosca.translate(...(eixo === "x" ? [4.5, 0, 0] : [0, 0, -4.5]));
  g.add(malha(rosca, M.acoEscuro));
  return g;
}

function coroa(M) {
  const g = new THREE.Group();
  const N = 30, rTopo = 22.5, rRaiz = 18.2, p = 2 * PI / N;
  const s = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = i * p;
    const pts = [[rRaiz, a], [rTopo, a + 0.3 * p], [rTopo, a + 0.55 * p], [rRaiz, a + 0.85 * p]];
    pts.forEach((q, k) => {
      const x = q[0] * Math.cos(q[1]), y = q[0] * Math.sin(q[1]);
      if (i === 0 && k === 0) s.moveTo(x, y); else s.lineTo(x, y);
    });
  }
  s.closePath();
  const furo = new THREE.Path(); furo.absarc(0, 0, 11, 0, 2 * PI, true); s.holes.push(furo);
  const dentes = new THREE.ExtrudeGeometry(s, { depth: 11, bevelEnabled: true, bevelThickness: 0.6,
    bevelSize: 0.5, bevelSegments: 1, curveSegments: 24 });
  dentes.translate(0, 0, -5.5);
  g.add(malha(dentes, M.bronze));
  // cubo de aço com rasgo de chaveta
  g.add(malha(noEixo(anel(11.2, 7, 16), "z"), M.acoEscuro));
  g.add(malha(new THREE.BoxGeometry(4, 2.2, 16.2), M.furo, 0, 7.6, 0));
  // furos de alívio da coroa
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3;
    g.add(malha(noEixo(anel(1.6, 0, 12.4), "z"), M.furo, 15 * Math.cos(a), 15 * Math.sin(a), 0));
  }
  return g;
}

function eixoSaida(M) {
  const g = new THREE.Group();
  // eixo maciço Ø 14 de z = -26 a z = +80, com colar junto à coroa
  g.add(malha(noEixo(new THREE.CylinderGeometry(7, 7, 106, 32), "z"), M.aco, 0, 0, 27));
  g.add(malha(noEixo(new THREE.CylinderGeometry(9, 9, 6, 32), "z"), M.aco, 0, 0, -11));
  g.add(malha(noEixo(new THREE.CylinderGeometry(6, 7, 2, 32), "z"), M.aco, 0, 0, 81));
  // rasgos de chaveta
  g.add(malha(new THREE.BoxGeometry(4.2, 1, 16), M.furo, 0, 6.8, 0));
  g.add(malha(new THREE.BoxGeometry(4.2, 1, 24), M.furo, 0, 6.8, 62));
  return g;
}

function chaveta(M, comprimento, eixo) {
  const geo = new THREE.BoxGeometry(4, 4, comprimento);
  if (eixo === "x") geo.rotateY(PI / 2);
  return malha(geo, M.parafuso);
}

function rolamento(M, rOut, rIn, largura, eixo) {
  const g = new THREE.Group();
  const e = (rOut - rIn) * 0.26;
  g.add(malha(noEixo(anel(rOut, rOut - e, largura, 48), eixo), M.aco));
  g.add(malha(noEixo(anel(rIn + e, rIn, largura, 48), eixo), M.aco));
  // gaiola escura e esferas visíveis
  const rm = (rOut + rIn) / 2, rb = (rOut - rIn - 2 * e) / 2 * 0.95;
  g.add(malha(noEixo(anel(rOut - e, rIn + e, largura * 0.55, 48), eixo), M.acoEscuro));
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = i * 2 * PI / n;
    const u = rm * Math.cos(a), v = rm * Math.sin(a);
    const pos = eixo === "x" ? [0, u, v] : [u, v, 0];
    g.add(malha(new THREE.SphereGeometry(rb, 16, 12), M.aco, ...pos));
  }
  return g;
}

function retentor(M, rOut, rIn, largura, eixo) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(rOut, rIn, largura, 48), eixo), M.borracha));
  g.add(malha(noEixo(anel(rOut - 0.8, rIn + 1.5, largura + 0.4, 48), eixo), M.acoEscuro));
  return g;
}

function junta(M, r, eixo) {
  const geo = new THREE.TorusGeometry(r, 1, 10, 48);
  if (eixo === "x") geo.rotateY(PI / 2);
  return malha(geo, M.borracha);
}

// Tampa com encaixe (rebaixo) voltado para a carcaça; furo central opcional.
function tampa(M, rOut, rEncaixe, rFuro, espessura, eixo, sentido, raioFuros, nFuros) {
  const g = new THREE.Group();
  const h = espessura;
  // perfil no plano (r, y): disco + encaixe voltado para -y
  const pts = rFuro > 0
    ? [[rFuro, -h / 2 - 4], [rEncaixe, -h / 2 - 4], [rEncaixe, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rFuro, h / 2], [rFuro, -h / 2 - 4]]
    : [[0, -h / 2 - 4], [rEncaixe, -h / 2 - 4], [rEncaixe, -h / 2], [rOut, -h / 2], [rOut, h / 2], [0, h / 2]];
  const geo = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 64);
  // a face externa da tampa fica no sentido +eixo quando sentido = 1
  if (sentido < 0) geo.rotateX(PI);
  g.add(malha(noEixo(geo, eixo), M.verde));
  for (let i = 0; i < nFuros; i++) {
    const a = PI / 4 + i * 2 * PI / nFuros;
    const u = raioFuros * Math.cos(a), v = raioFuros * Math.sin(a);
    const d = sentido * (h / 2 + 0.05);
    const pos = eixo === "x" ? [d, v, u] : [u, v, d];
    g.add(malha(noEixo(anel(2, 0, 0.4), eixo), M.furo, ...pos));
  }
  return g;
}

function parafusos(M, raio, n, eixo, sentido, comprimento) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = PI / 4 + i * 2 * PI / n;
    const u = raio * Math.cos(a), v = raio * Math.sin(a);
    const p = new THREE.Group();
    // cabeça + arruela + corpo, com a cabeça no sentido +eixo quando sentido = 1
    p.add(malha(new THREE.CylinderGeometry(3, 3, 3.5, 20), M.parafuso, 0, 1.75, 0));
    p.add(malha(new THREE.CylinderGeometry(1.4, 1.4, 0.6, 6), M.furo, 0, 3.55, 0));
    p.add(malha(anel(3.6, 1.8, 0.8, 24), M.aco, 0, -0.4, 0));
    p.add(malha(new THREE.CylinderGeometry(1.6, 1.6, comprimento, 12), M.acoEscuro, 0, -comprimento / 2 - 0.8, 0));
    if (eixo === "x") p.rotation.z = -sentido * PI / 2;
    if (eixo === "z") p.rotation.x = sentido * PI / 2;
    p.position.set(...(eixo === "x" ? [0, v, u] : [u, v, 0]));
    g.add(p);
  }
  return g;
}

class Helice extends THREE.Curve {
  constructor(raio, passo, voltas, x0, fase) {
    super();
    Object.assign(this, { raio, passo, voltas, x0, fase });
  }
  getPoint(t, alvo = new THREE.Vector3()) {
    const a = this.fase + t * this.voltas * 2 * PI;
    return alvo.set(this.x0 + t * this.voltas * this.passo, this.raio * Math.cos(a), this.raio * Math.sin(a));
  }
}

function rosca(M) {
  const g = new THREE.Group();
  const cil = (r, c, x, mat) => g.add(malha(noEixo(new THREE.CylinderGeometry(r, r, c, 32), "x"), mat || M.aco, x, 0, 0));
  cil(6, 22, -30);          // apoio do rolamento traseiro
  cil(7.2, 40, 0);          // núcleo da rosca
  cil(6, 22, 30);           // apoio do rolamento dianteiro
  cil(5.5, 52, 67);         // ponta de entrada Ø 11 (motor)
  // filetes da rosca: 4 entradas (30 dentes da coroa ÷ 4 = redução 1:7,5)
  [0, PI / 2, PI, 3 * PI / 2].forEach((f) => {
    const geo = new THREE.TubeGeometry(new Helice(7.7, 16.8, 2, -16.8, f), 160, 1.3, 10, false);
    g.add(malha(geo, M.aco));
  });
  // rasgo de chaveta na ponta de entrada
  g.add(malha(new THREE.BoxGeometry(22, 1, 3.2), M.furo, 76, 5.2, 0));
  return g;
}

// ---------- montagem ----------

// Cada entrada: peça, posição montada e deslocamento na vista explodida.
function montar(M) {
  const L = [];
  const add = (id, obj, pos, desl) => {
    obj.position.set(...pos);
    obj.userData = { peca: id, base: new THREE.Vector3(...pos), desl: new THREE.Vector3(...desl) };
    L.push(obj);
  };
  add("carcaca", carcaca(M), [0, 0, 0], [0, 0, 0]);
  add("respiro", respiro(M), [0, 46, 0], [0, 48, 0]);
  add("bujoes", bujao(M, "x"), [-43.2, 20, 0], [-38, 18, 0]);
  add("bujoes", bujao(M, "z"), [22, -34, 29.2], [0, -8, 55]);

  // eixo de saída (Z+: frente, aparece embaixo à esquerda)
  add("eixo-saida", eixoSaida(M), [0, 0, 0], [0, 0, 70]);
  add("chavetas", chaveta(M, 14, "z"), [0, 9, 0], [-16, 10, 82]);
  add("chavetas", chaveta(M, 22, "z"), [0, 9, 62], [-22, 8, 112]);
  add("coroa", coroa(M), [0, 0, 0], [0, 0, 160]);
  add("juntas", junta(M, 24, "z"), [0, 0, 31.5], [0, 0, 155]);
  add("rolamentos-saida", rolamento(M, 17.5, 7, 11, "z"), [0, 0, 22], [0, 0, 175]);
  add("tampas-saida", tampa(M, 34, 21, 8, 7, "z", 1, 27, 4), [0, 0, 35], [0, 0, 190]);
  add("retentores", retentor(M, 12, 7, 5, "z"), [0, 0, 36], [0, 0, 215]);
  add("parafusos", parafusos(M, 27, 4, "z", 1, 14), [0, 0, 38.5], [0, 0, 230]);
  // lado traseiro (Z-: aparece em cima à direita)
  add("rolamentos-saida", rolamento(M, 17.5, 7, 11, "z"), [0, 0, -22], [0, 0, -70]);
  add("juntas", junta(M, 24, "z"), [0, 0, -31.5], [0, 0, -78]);
  add("tampas-saida", tampa(M, 31, 21, 0, 6, "z", -1, 27, 4), [0, 0, -34.5], [0, 0, -95]);
  add("parafusos", parafusos(M, 27, 4, "z", -1, 14), [0, 0, -37.5], [0, 0, -120]);

  // rosca sem fim (X+: aparece embaixo à direita)
  add("rosca", rosca(M), [0, -28, 0], [70, 0, 0]);
  add("chavetas", chaveta(M, 20, "x"), [76, -20.5, 0], [70, 14, 0]);
  add("rolamentos-entrada", rolamento(M, 15.5, 6, 10, "x"), [36, -28, 0], [142, 0, 0]);
  add("juntas", junta(M, 18, "x"), [46.5, -28, 0], [143.5, 0, 0]);
  add("tampas-entrada", tampa(M, 22, 16, 6, 6, "x", 1, 18, 4), [49, -28, 0], [155, 0, 0]);
  add("retentores", retentor(M, 10, 5.5, 4.5, "x"), [50.5, -28, 0], [171.5, 0, 0]);
  add("parafusos", parafusos(M, 18, 4, "x", 1, 12), [52, -28, 0], [188, 0, 0]);
  // lado oposto da rosca (X-: aparece em cima à esquerda)
  add("rolamentos-entrada", rolamento(M, 15.5, 6, 10, "x"), [-36, -28, 0], [-62, 0, 0]);
  add("juntas", junta(M, 18, "x"), [-46.5, -28, 0], [-72, 0, 0]);
  add("tampas-entrada", tampa(M, 22, 16, 0, 6, "x", -1, 18, 4), [-49, -28, 0], [-92, 0, 0]);
  add("parafusos", parafusos(M, 18, 4, "x", -1, 12), [-52, -28, 0], [-115, 0, 0]);
  return L;
}

const suave = (t) => t * t * (3 - 2 * t);

/**
 * Cria o visualizador dentro de `caixa`.
 * opcoes.aoSelecionar(idPeca|null) é chamada quando o operador toca numa peça.
 */
export function criarVisualizador(caixa, opcoes) {
  opcoes = opcoes || {};
  const M = materiais();
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 5000);
  const render = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  render.localClippingEnabled = true;
  caixa.appendChild(render.domElement);

  cena.add(new THREE.HemisphereLight(0xffffff, 0x7d8a99, 1.5));
  const sol = new THREE.DirectionalLight(0xffffff, 2.2); sol.position.set(120, 220, 160); cena.add(sol);
  const contra = new THREE.DirectionalLight(0xdfe8ff, 0.9); contra.position.set(-180, 60, -140); cena.add(contra);

  const conjunto = new THREE.Group();
  cena.add(conjunto);
  const objetos = montar(M);
  objetos.forEach((o) => conjunto.add(o));

  // cada malha recebe material próprio para poder ser destacada individualmente
  const malhas = [];
  objetos.forEach((o) => o.traverse((m) => {
    if (m.isMesh) {
      m.material = m.material.clone();
      m.userData.peca = o.userData.peca;
      m.userData.raiz = o;
      malhas.push(m);
    }
  }));

  // balões numerados
  const camadaBaloes = document.createElement("div");
  camadaBaloes.className = "baloes";
  caixa.appendChild(camadaBaloes);
  const linhas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  linhas.setAttribute("class", "chamadas");
  camadaBaloes.appendChild(linhas);
  const baloes = PECAS.map((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "balao";
    b.textContent = String(i + 1);
    b.title = p.nome;
    b.addEventListener("click", (ev) => { ev.stopPropagation(); selecionar(p.id, true); });
    camadaBaloes.appendChild(b);
    const ancora = objetos.find((o) => o.userData.peca === p.id);
    const caixaLocal = new THREE.Box3().setFromObject(ancora);
    const centro = caixaLocal.getCenter(new THREE.Vector3()).sub(ancora.position);
    return { el: b, peca: p.id, ancora, centro };
  });

  let explosao = 0, alvoExplosao = 1, destaque = [], selecionada = null, mostrarBaloes = true;
  let corte = false, isolada = null;
  const internas = PECAS.filter((p) => p.interna).map((p) => p.id);

  // Vista em corte: tira o quarto da carcaça e das tampas voltado para a câmera (x > 0 e z > 0),
  // deixando à mostra a coroa, a rosca sem fim, os rolamentos e os eixos.
  const CASCA = ["carcaca", "tampas-saida", "tampas-entrada", "juntas", "retentores", "parafusos", "bujoes"];
  const planosCorte = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
  const cortado = (m, p) => corte && CASCA.indexOf(m.userData.peca) >= 0 && p.x > 0 && p.z > 0;
  function aplicarCorte(sim) {
    corte = sim;
    malhas.forEach((m) => {
      if (CASCA.indexOf(m.userData.peca) < 0) return;
      m.material.clippingPlanes = sim ? planosCorte : null;
      m.material.clipIntersection = true;
      m.material.side = sim ? THREE.DoubleSide : THREE.FrontSide;
      m.material.needsUpdate = true;
    });
  }

  // Mostra só uma peça (todas as unidades dela) e aproxima a câmera.
  function isolar(id) {
    isolada = id || null;
    objetos.forEach((o) => { o.visible = !isolada || o.userData.peca === isolada; });
    if (isolada) selecionada = isolada;
    vistaInicial(true);
  }
  const controles = new OrbitControls(camera, render.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.autoRotateSpeed = 1.2;
  controles.addEventListener("start", () => { camAlvo = null; });

  function aplicarExplosao() {
    const k = suave(explosao);
    objetos.forEach((o) => o.position.copy(o.userData.base).addScaledVector(o.userData.desl, k));
  }

  // enquadra o conjunto (montado ou explodido) na mesma direção da figura de referência
  let camAlvo = null;
  function vistaInicial(animar) {
    const salvo = explosao;
    explosao = alvoExplosao; aplicarExplosao();
    const pontos = [];
    objetos.filter((o) => o.visible).forEach((o) => {
      const c = new THREE.Box3().setFromObject(o);
      for (let i = 0; i < 8; i++) {
        pontos.push(new THREE.Vector3(i & 1 ? c.max.x : c.min.x, i & 2 ? c.max.y : c.min.y, i & 4 ? c.max.z : c.min.z));
      }
    });
    explosao = salvo; aplicarExplosao();
    const centro = new THREE.Box3().setFromPoints(pontos).getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(1, 0.62, 1).normalize();
    // eixos da câmera olhando para o centro
    const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    const cima = new THREE.Vector3().crossVectors(dir, direita);
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.92;
    const tx = ty * camera.aspect;
    let d = 10;
    pontos.forEach((p) => {
      const r = p.clone().sub(centro);
      const x = Math.abs(r.dot(direita)), y = Math.abs(r.dot(cima)), z = r.dot(dir);
      d = Math.max(d, z + x / tx, z + y / ty);
    });
    const pos = centro.clone().addScaledVector(dir, d);
    camera.near = d / 50; camera.far = d * 6; camera.updateProjectionMatrix();
    controles.minDistance = d * 0.2; controles.maxDistance = d * 3;
    if (animar) { camAlvo = { pos, centro }; return; }
    camAlvo = null;
    controles.target.copy(centro);
    camera.position.copy(pos);
    controles.update();
  }

  function tamanho() {
    const w = caixa.clientWidth, h = caixa.clientHeight;
    if (!w || !h) return;
    render.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const obs = new ResizeObserver(() => { const antes = camera.aspect; tamanho(); if (Math.abs(antes - camera.aspect) > 0.2) vistaInicial(); });
  obs.observe(caixa);
  tamanho();
  vistaInicial();

  function atualizarMateriais(tempo) {
    // peça isolada aparece com a cor natural, sem o brilho de destaque
    const foco = isolada ? [] : selecionada ? [selecionada] : destaque;
    const brilho = 0.35 + 0.25 * Math.sin(tempo / 260);
    malhas.forEach((m) => {
      const ativo = foco.indexOf(m.userData.peca) >= 0;
      const apagado = foco.length > 0 && !ativo;
      m.material.emissive.setRGB(ativo ? brilho : 0, ativo ? brilho * 0.62 : 0, 0);
      m.material.transparent = apagado;
      m.material.opacity = apagado ? 0.16 : 1;
      m.material.depthWrite = !apagado;
    });
  }

  const v = new THREE.Vector3();
  function atualizarBaloes() {
    // montado, os balões se amontoam: aparecem com o conjunto explodido, só nas peças
    // internas na vista em corte, ou só na peça isolada
    const explodido = explosao > 0.5;
    const visivel = mostrarBaloes && (explodido || corte || isolada);
    camadaBaloes.style.display = visivel ? "" : "none";
    if (!visivel) return;
    const w = caixa.clientWidth, h = caixa.clientHeight;
    const foco = selecionada ? [selecionada] : destaque;
    const vis = [];
    baloes.forEach((b) => {
      b.el.hidden = isolada ? b.peca !== isolada : !explodido && internas.indexOf(b.peca) < 0;
      b.el.classList.toggle("ativo", foco.indexOf(b.peca) >= 0);
      b.el.classList.toggle("apagado", foco.length > 0 && foco.indexOf(b.peca) < 0);
      if (b.el.hidden) return;
      v.copy(b.centro).add(b.ancora.position).project(camera);
      const ax = (v.x + 1) / 2 * w, ay = (1 - v.y) / 2 * h;
      vis.push({ b, ax, ay, x: ax, y: ay });
    });
    // afasta os balões que se sobrepõem; uma linha de chamada liga cada um à sua peça
    const MIN = 30;
    for (let it = 0; it < 40; it++) {
      for (let i = 0; i < vis.length; i++) {
        for (let j = i + 1; j < vis.length; j++) {
          const a = vis[i], c = vis[j];
          let dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy);
          if (d >= MIN) continue;
          if (d < 0.01) { dx = j - i; dy = -1; d = Math.hypot(dx, dy); }
          const f = (MIN - d) / 2 / d;
          a.x -= dx * f; a.y -= dy * f; c.x += dx * f; c.y += dy * f;
        }
      }
    }
    let svg = "";
    vis.forEach((q) => {
      q.x = Math.min(w - 14, Math.max(14, q.x)); q.y = Math.min(h - 14, Math.max(14, q.y));
      q.b.el.style.transform = "translate(" + (q.x - 13) + "px," + (q.y - 13) + "px)";
      if (Math.hypot(q.x - q.ax, q.y - q.ay) > 12) {
        svg += '<line x1="' + q.ax.toFixed(1) + '" y1="' + q.ay.toFixed(1) + '" x2="' + q.x.toFixed(1) + '" y2="' + q.y.toFixed(1) + '"/>' +
          '<circle cx="' + q.ax.toFixed(1) + '" cy="' + q.ay.toFixed(1) + '" r="2.5"/>';
      }
    });
    linhas.innerHTML = svg;
  }

  // toque/clique numa peça
  const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2();
  let inicio = null;
  render.domElement.addEventListener("pointerdown", (ev) => { inicio = [ev.clientX, ev.clientY]; });
  render.domElement.addEventListener("pointerup", (ev) => {
    if (!inicio || Math.hypot(ev.clientX - inicio[0], ev.clientY - inicio[1]) > 6) return;
    const r = render.domElement.getBoundingClientRect();
    ponteiro.set((ev.clientX - r.left) / r.width * 2 - 1, -(ev.clientY - r.top) / r.height * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const naCena = malhas.filter((m) => m.userData.raiz.visible);
    const visiveis = naCena.filter((m) => !m.material.transparent);
    const hit = raio.intersectObjects(visiveis.length ? visiveis : naCena, false)
      .filter((h) => !cortado(h.object, h.point))[0];
    selecionar(hit ? hit.object.userData.peca : null, true);
  });

  function selecionar(id, peloUsuario) {
    selecionada = id === selecionada ? null : id;
    if (peloUsuario && opcoes.aoSelecionar) opcoes.aoSelecionar(selecionada);
  }

  let ativo = true, ultimo = performance.now();
  function quadro(agora) {
    if (!ativo) return;
    requestAnimationFrame(quadro);
    if (!caixa.isConnected || document.hidden || !caixa.clientWidth) return;
    const dt = Math.min(0.05, (agora - ultimo) / 1000); ultimo = agora;
    if (explosao !== alvoExplosao) {
      const passo = dt / 1.2;
      explosao = alvoExplosao > explosao ? Math.min(alvoExplosao, explosao + passo) : Math.max(alvoExplosao, explosao - passo);
      aplicarExplosao();
      if (opcoes.aoExplodir) opcoes.aoExplodir(explosao);
    }
    if (camAlvo) {
      const k = 1 - Math.exp(-dt * 5);
      camera.position.lerp(camAlvo.pos, k);
      controles.target.lerp(camAlvo.centro, k);
      if (camera.position.distanceTo(camAlvo.pos) < 0.5) camAlvo = null;
    }
    controles.update();
    atualizarMateriais(agora);
    render.render(cena, camera);
    atualizarBaloes();
  }
  aplicarExplosao();
  requestAnimationFrame(quadro);

  return {
    pecas: PECAS,
    // 0 = montado, 1 = explodido
    explodir(t, animar) {
      alvoExplosao = Math.max(0, Math.min(1, t));
      if (!animar) { explosao = alvoExplosao; aplicarExplosao(); }
    },
    get explosao() { return alvoExplosao; },
    destacar(ids) { destaque = ids || []; selecionada = null; },
    selecionar(id) { selecionada = id || null; },
    girar(sim) { controles.autoRotate = !!sim; },
    // vista em corte (por dentro)
    corte(sim) { aplicarCorte(!!sim); },
    isolar,
    get isolada() { return isolada; },
    baloes(sim) { mostrarBaloes = !!sim; },
    vistaInicial,
    destruir() {
      ativo = false; obs.disconnect(); controles.dispose(); render.dispose();
      malhas.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      caixa.innerHTML = "";
    }
  };
}
