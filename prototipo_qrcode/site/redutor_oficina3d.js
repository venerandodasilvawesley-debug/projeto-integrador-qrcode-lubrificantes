// Modelo 3D simplificado do redutor da oficina (WEG-Cestari coroa e rosca, eixo de saída vazado,
// flange para motor), usado na ficha de lubrificação para mostrar enchimento, nível e dreno
// e, em vista explodida, os componentes com a tag de cada um.
// Desenhado por código a partir das fotos do redutor real (placa e adesivo são as próprias fotos), em medidas aproximadas: eixo de saída na direção Z,
// rosca sem fim na direção X (flange do motor em -X, tampa cega em +X), base para baixo.
// A posição dos bujões segue a marcação feita pela equipe no redutor.
import * as THREE from "./vendor/three.module.min.js";
import { criarVisualizador as criarBase, anel, noEixo, malha, rolamento } from "./redutor3d.js";

// Peças com número de balão e ficha (mesmo formato do modelo da Inspeção). "interna" = fica dentro da carcaça.
// Sem o manual de peças do fabricante, as peças internas seguem o arranjo usual de um redutor coroa e rosca
// deste porte: o que foi conferido no redutor da oficina está dito na ficha; o resto se confirma ao desmontar.
const CONFIRMAR = " Sem manual de peças: conferir o código gravado na peça ao desmontar.";
export const PECAS = [
  { id: "carcaca", sigla: "CAR", nome: "Carcaça", tipo: "Carcaça fundida com pés de fixação e flange para motor",
    material: "Ferro fundido, pintado de azul", qtd: "1",
    espec: "Medida pela equipe: altura 225 mm, largura 116 mm. Massa do redutor 18,1 kg (sem óleo e sem os bujões).",
    funcao: "Aloja e alinha a coroa e a rosca sem fim, guarda o óleo e troca calor com o ar.",
    inspecao: "Trincas, pintura queimada (superaquecimento), vazamentos e aperto dos pés.",
    falhas: "Trinca por sobrecarga ou base desnivelada; carcaça suja de pó esquenta mais." },
  { id: "placa", sigla: "PLC", nome: "Placa de identificação", tipo: "Placa metálica rebitada",
    material: "Alumínio ou aço inox", qtd: "1",
    espec: "Série 818100, código M0612802V0D001, i = 25, n1 1750 rpm, n2 70 rpm, 1,75 kW, óleo ISO VG 460 PAO.",
    funcao: "Identifica o redutor: com o código e a série o fabricante informa as peças de reposição.",
    inspecao: "Legível, limpa e sem tinta por cima.",
    falhas: "Placa pintada ou arrancada: sem ela não se consegue pedir peça nem o manual." },
  { id: "respiro", sigla: "RSP", nome: "Respiro (enchimento)", tipo: "Válvula de respiro de latão",
    material: "Latão", qtd: "1",
    espec: "No ponto mais alto, na face de cima. Retirar o lacre antes de colocar em operação.",
    funcao: "Deixa o ar sair quando o óleo esquenta; é também o furo de enchimento.",
    inspecao: "Limpo, desobstruído e sem o lacre.",
    falhas: "Entupido por pó ou tinta: a pressão empurra o óleo pelos retentores." },
  { id: "nivel", sigla: "NIV", nome: "Bujões de nível", tipo: "Bujão sextavado com arruela de vedação",
    material: "Aço zincado; arruela de cobre ou alumínio", qtd: "2 (usa-se o NIV-02, do meio)",
    espec: "Na posição de montagem adotada o nível certo é o do bujão do meio (NIV-02).",
    funcao: "Conferir o nível: o óleo deve chegar na borda do furo.",
    inspecao: "Sem vazamento; arruela inteira.",
    falhas: "Arruela reaproveitada amassada ou rosca espanada por aperto demais." },
  { id: "dreno", sigla: "DRE", nome: "Bujões de dreno", tipo: "Bujão sextavado com arruela de vedação",
    material: "Aço zincado; arruela de cobre ou alumínio", qtd: "2",
    espec: "DRE-01 embaixo na face da tampa cega; DRE-02 na base.",
    funcao: "Escoar o óleo usado na troca.",
    inspecao: "Sem vazamento; limpar o ímã ou a ponta, se tiver, e olhar se há limalha.",
    falhas: "Limalha de bronze na ponta indica desgaste da coroa." },
  { id: "coroa", sigla: "COR", nome: "Coroa (bronze)", tipo: "Coroa para rosca sem fim", interna: true,
    material: "Aro de bronze com cubo de aço (bronze conferido pela equipe)", qtd: "1",
    espec: "Redução 1:25 (placa): por exemplo 50 dentes com rosca de 2 entradas. O desenho é ilustrativo." + CONFIRMAR,
    funcao: "Engrenagem movida: recebe o giro da rosca sem fim e gira o eixo de saída 25 vezes mais devagar (70 rpm).",
    inspecao: "Pó de bronze no óleo, desgaste e crateras (pitting) nos dentes.",
    falhas: "Desgaste rápido com óleo errado ou velho; é a peça que mais sofre quando falta óleo." },
  { id: "chaveta", sigla: "CHV", nome: "Chaveta da coroa", tipo: "Chaveta paralela", interna: true,
    material: "Aço carbono", qtd: "1",
    espec: "Trava a coroa no eixo de saída." + CONFIRMAR,
    funcao: "Transmite o torque da coroa para o eixo de saída.",
    inspecao: "Folga ou batida na partida.",
    falhas: "Chaveta amassada ou cisalhada por travamento da máquina." },
  { id: "eixo-saida", sigla: "EIX", nome: "Eixo de saída vazado", tipo: "Eixo oco (vazado) com rasgo de chaveta", interna: true,
    material: "Aço", qtd: "1",
    espec: "O eixo da máquina entra por dentro dele, travado por chaveta. Medida da equipe: Ø externo 55 mm.",
    funcao: "Entrega o movimento reduzido (70 rpm) e o torque para a máquina.",
    inspecao: "Folga, ruído e marcas na pista dos retentores.",
    falhas: "Pista do retentor riscada (vaza óleo), rasgo de chaveta deformado." },
  { id: "rolamentos-saida", sigla: "ROL", nome: "Rolamentos do eixo de saída", tipo: "Rolamento (esferas ou rolos cônicos)", interna: true,
    material: "Aço para rolamentos", qtd: "2",
    espec: "Um de cada lado da coroa. A designação vem gravada no anel externo." + CONFIRMAR,
    funcao: "Apoiam o eixo de saída e seguram o esforço da coroa.",
    inspecao: "Ruído, aquecimento e folga no eixo.",
    falhas: "Ruído áspero por óleo sujo ou falta de óleo." },
  { id: "rosca", sigla: "RSF", nome: "Rosca sem fim / eixo de entrada", tipo: "Rosca sem fim com eixo de entrada vazado e estriado", interna: true,
    material: "Aço (conferido pela equipe), normalmente temperado e retificado", qtd: "1",
    espec: "Entrada pelo eixo vazado estriado da flange, onde encaixa o eixo do motor (1750 rpm)." + CONFIRMAR,
    funcao: "Recebe o giro do motor e empurra os dentes da coroa.",
    inspecao: "Giro suave, sem folga e sem aquecimento.",
    falhas: "Filetes gastos por óleo contaminado; aquece por atrito se o óleo estiver baixo." },
  { id: "rolamentos-entrada", sigla: "ROL", nome: "Rolamentos da rosca sem fim", tipo: "Rolamento (esferas ou rolos cônicos)", interna: true,
    material: "Aço para rolamentos", qtd: "2",
    espec: "Um em cada ponta da rosca; seguram o empurrão axial da rosca." + CONFIRMAR,
    funcao: "Apoiam a rosca sem fim.",
    inspecao: "Ruído e aquecimento no lado da flange e no lado da tampa cega.",
    falhas: "Desgaste pelo esforço axial e por óleo sujo." },
  { id: "retentores", sigla: "RET", nome: "Retentores", tipo: "Retentor de lábio com mola", interna: true,
    material: "Borracha nitrílica com armação de aço", qtd: "3",
    espec: "2 no eixo de saída (um de cada lado) e 1 no eixo de entrada. Medida gravada: eixo × alojamento × largura.",
    funcao: "Seguram o óleo onde os eixos saem da carcaça e barram o pó.",
    inspecao: "Óleo escorrendo em volta dos eixos.",
    falhas: "Lábio ressecado pelo calor ou gasto pelo eixo riscado." },
  { id: "tampas", sigla: "TMP", nome: "Tampas", tipo: "Tampa do eixo de saída, tampa cega da rosca e tampa da flange",
    material: "Metal pintado; tampa cega preta de pressão", qtd: "3",
    espec: "TMP-01 aparafusada no eixo de saída; TMP-02 tampa cega preta da rosca; TMP-03 tampa central da flange (fundo vermelho).",
    funcao: "Fecham a carcaça e seguram os rolamentos no lugar.",
    inspecao: "Vazamento em volta e parafusos apertados.",
    falhas: "Vaza por vedação velha ou parafuso frouxo." },
  { id: "parafusos", sigla: "PAR", nome: "Parafusos das tampas", tipo: "Parafuso sextavado (tampa de saída) e Allen (tampa da flange)",
    material: "Aço", qtd: "10 (6 + 4)",
    espec: "Apertar em cruz, sem exagero, para não empenar a tampa.",
    funcao: "Prendem as tampas na carcaça.",
    inspecao: "Aperto e ferrugem.",
    falhas: "Afrouxam com a vibração; rosca espanada por aperto demais." },
  { id: "etiqueta", sigla: "QR", nome: "Etiqueta com QR Code", tipo: "Etiqueta plastificada com QR Code da ficha",
    material: "Papel plastificado e fita dupla-face", qtd: "1",
    espec: "Abre a ficha deste redutor no celular.",
    funcao: "Leva o mecânico direto para as informações de lubrificação, no próprio equipamento.",
    inspecao: "Legível e bem colada.",
    falhas: "Suja de óleo ou descolada: o celular não lê." }
];

// Tinta azul com o aspecto do redutor real: leve granulado e lascas onde aparece o fundo vermelho.
// Desenhada por código (sempre igual), para não depender de imagem.
function tinta(semente) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  let s = semente;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  x.fillStyle = "#217ec0";
  x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,20,60,.07)";
    x.beginPath(); x.arc(rnd() * 512, rnd() * 512, 1 + rnd() * 2.5, 0, 7); x.fill();
  }
  for (let i = 0; i < 30; i++) {
    const cx = rnd() * 512, cy = rnd() * 512, n = 2 + Math.floor(rnd() * 5);
    x.fillStyle = rnd() < 0.8 ? "#b9502f" : "#8f918d";
    for (let k = 0; k < n; k++) {
      x.beginPath();
      x.ellipse(cx + (rnd() - 0.5) * 14, cy + (rnd() - 0.5) * 10, 1.5 + rnd() * 4.5, 1 + rnd() * 2.5, rnd() * 3, 0, 7);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function foto(arquivo) {
  const t = new THREE.TextureLoader().load(arquivo);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function materiais() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  const pintura = tinta(7);
  return {
    azul: m({ map: pintura, roughness: 0.6, metalness: 0.08 }),
    azulEscuro: m({ map: pintura, color: 0xc4cfdb, roughness: 0.65, metalness: 0.08 }), // mesma tinta, um tom abaixo
    latao: m({ color: 0xc9a23a, roughness: 0.3, metalness: 0.8 }),
    placa: m({ map: foto("/fotos/red-placa.jpg"), roughness: 0.5, metalness: 0.2 }),    // foto da placa real
    adesivo: m({ map: foto("/fotos/red-lacre.jpg"), roughness: 0.75, metalness: 0 }),  // foto do adesivo real
    zinco: m({ color: 0xd5dade, roughness: 0.4, metalness: 0.6 }),
    primer: m({ color: 0xc4512f, roughness: 0.7, metalness: 0.05 }),   // fundo vermelho da face da flange
    usinado: m({ color: 0x9a9488, roughness: 0.45, metalness: 0.75 })   // faces usinadas, sem pintura
  };
}

const caixa = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cil = (r, h, eixo, lados) => noEixo(new THREE.CylinderGeometry(r, r, h, lados || 24), eixo);

// corpo fundido: caixa com os cantos arredondados (150 × 178 × 110)
function corpo() {
  const w = 72, h = 86, r = 9, f = new THREE.Shape();
  f.moveTo(-w + r, -h); f.lineTo(w - r, -h); f.quadraticCurveTo(w, -h, w, -h + r);
  f.lineTo(w, h - r); f.quadraticCurveTo(w, h, w - r, h);
  f.lineTo(-w + r, h); f.quadraticCurveTo(-w, h, -w, h - r);
  f.lineTo(-w, -h + r); f.quadraticCurveTo(-w, -h, -w + r, -h);
  const geo = new THREE.ExtrudeGeometry(f, { depth: 104, bevelEnabled: true, bevelThickness: 3, bevelSize: 3, bevelSegments: 3, curveSegments: 6 });
  geo.translate(0, 0, -52);
  const uv = geo.attributes.uv; // a extrusão mede a textura em milímetros: passa para 0–1
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 150, uv.getY(i) / 150);
  return geo;
}

function carcaca(M) {
  const g = new THREE.Group();
  const p = (geo, mat, x, y, z) => { const o = malha(geo, mat, x, y, z); g.add(o); return o; };
  p(corpo(), M.azul, 0, 0, 0);

  // sapatas de fixação, em cima e embaixo
  [[-59, 1], [59, 1], [-59, -1], [59, -1]].forEach(([x, s]) => {
    p(caixa(32, 7, 106), M.azulEscuro, x, s * 92, 0);
    [-36, 34].forEach((z) => {
      if (s > 0) { // tampões de proteção dos furos roscados, com sextavado interno
        p(cil(10, 1.6, "y"), M.zinco, x, 96.3, z);
        p(cil(8.2, 5, "y"), M.zinco, x, 99, z);
        p(cil(3.6, 0.8, "y", 6), M.furo, x, 101.3, z);
      } else {
        p(cil(6.5, 0.8, "y"), M.usinado, x, -95.7, z);
        p(cil(4.6, 1, "y"), M.furo, x, -95.9, z);
      }
    });
  });

  // faces do eixo de saída: frente (+Z, tampa aparafusada) e trás (-Z, ressalto fundido com furos roscados)
  [1, -1].forEach((s) => {
    const zf = s * 55;
    [-62, -70, -78].forEach((y) => p(caixa(104, 3.2, 2), M.azulEscuro, 0, y, zf + s * 0.8)); // nervuras de baixo
    if (s < 0) {
      p(noEixo(anel(40, 25, 6), "z"), M.azulEscuro, 0, 18, zf - 3);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, bx = Math.cos(a) * 46, by = 18 + Math.sin(a) * 46;
        p(cil(11, 6, "z"), M.azulEscuro, bx, by, zf - 3);
        p(cil(4, 0.8, "z"), M.furo, bx, by, zf - 6.2);
      }
    }
    const ze = zf + s * (s > 0 ? 9 : 6);
    if (s < 0) p(noEixo(anel(29, 22, 1.2), "z"), M.usinado, 0, 18, ze + s * 0.4);  // alojamento usinado do retentor
  });

  // face da tampa cega da rosca sem fim (+X): frisos, ressalto em "Y" e tampa preta
  [4, 16, 28].forEach((y) => [-30, 30].forEach((z) => p(caixa(1.6, 6, 40), M.azulEscuro, 75.2, y, z)));
  p(noEixo(anel(31, 0, 5), "x"), M.azulEscuro, 76.5, -52, 0);
  [-0.62, 0.62].forEach((a) => { const o = p(caixa(4, 30, 13), M.azulEscuro, 75.5, -52 + Math.cos(a) * 38, Math.sin(a) * 38); o.rotation.x = a; });
  p(caixa(4, 16, 13), M.azulEscuro, 75.5, -84, 0);
  p(noEixo(anel(27, 21.5, 1.2), "x"), M.usinado, 79.4, -52, 0);

  // lado do motor (-X): pescoço com nervuras e flange
  p(noEixo(new THREE.CylinderGeometry(33, 43, 34, 40), "x"), M.azul, -92, -52, 0);
  p(cil(9, 9, "z"), M.azul, -90, -52, 37);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2, o = p(caixa(26, 4, 26), M.azulEscuro, -97, -52 + Math.sin(a) * 50, Math.cos(a) * 50);
    o.rotation.x = -a;
  }
  p(noEixo(anel(72, 20, 9, 64), "x"), M.azul, -113, -52, 0);
  // face da flange (onde o motor encosta), como na foto: aro e encaixe usinados, fundo vermelho,
  // tampa central presa por 4 parafusos Allen e eixo de entrada vazado e estriado
  const fy = -52, face = (rOut, rIn, esp, mat, x) => p(noEixo(anel(rOut, rIn, esp, 64), "x"), mat, x, fy, 0);
  face(72, 63, 1.6, M.usinado, -118.2);            // aro externo usinado
  face(63, 47, 0.8, M.primer, -117.8);             // rebaixo vermelho
  face(47, 37, 2.4, M.usinado, -118.6);            // encaixe (centragem) do motor
  for (let i = 0; i < 4; i++) {
    // prisioneiros com porca sextavada, para prender o motor
    const a = i * Math.PI / 2 + Math.PI / 4 + 0.12, y = fy + Math.sin(a) * 60, z = Math.cos(a) * 60;
    p(cil(4, 34, "x", 14), M.zinco, -120, y, z);
    p(cil(8, 6, "x", 6), M.zinco, -121.5, y, z);
    p(cil(4.1, 6, "x", 14), M.azulEscuro, -134.5, y, z); // ponta pintada
  }

  // face de cima: placa de identificação (foto da placa real, com os rebites) e adesivo "Retire o lacre"
  p(deitado(34, 27.7), M.adesivo, 3, 89.12, 3);
  return g;
}
const deitado = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);

// grupo de peças desenhadas já na posição de montagem (coordenadas do redutor)
function grupo(...partes) {
  const g = new THREE.Group();
  partes.forEach((q) => g.add(q));
  return g;
}

function placa(M) {
  return grupo(malha(caixa(43, 0.6, 22), M.zinco, 0, 89.2, -37), malha(deitado(42, 20.5), M.placa, 0, 89.56, -37),
    ...[-17.5, 17.5].map((x) => malha(cil(2.1, 1, "y"), M.zinco, x, 89.9, -36)));
}

// coroa de bronze no eixo de saída (Z, centro em y = 18): 50 dentes, cubo de aço com rasgo de chaveta
function coroa(M) {
  const N = 50, rTopo = 58, rRaiz = 53.5, passo = 2 * Math.PI / N, f = new THREE.Shape();
  for (let i = 0; i < N; i++) {
    const a = i * passo;
    [[rRaiz, a], [rTopo, a + 0.3 * passo], [rTopo, a + 0.55 * passo], [rRaiz, a + 0.85 * passo]].forEach((q, k) => {
      const x = q[0] * Math.cos(q[1]), y = q[0] * Math.sin(q[1]);
      if (i === 0 && k === 0) f.moveTo(x, y); else f.lineTo(x, y);
    });
  }
  f.closePath();
  const furo = new THREE.Path(); furo.absarc(0, 0, 40, 0, 2 * Math.PI, true); f.holes.push(furo);
  const dentes = new THREE.ExtrudeGeometry(f, { depth: 24, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 1, curveSegments: 36 });
  dentes.translate(0, 18, -12);
  const g = grupo(malha(dentes, M.bronze));
  g.add(malha(noEixo(anel(40, 17, 18, 48), "z"), M.acoEscuro, 0, 18, 0));   // disco / cubo de aço
  g.add(malha(noEixo(anel(24, 17, 30, 48), "z"), M.acoEscuro, 0, 18, 0));
  for (let i = 0; i < 6; i++) {                                              // furos de alívio
    const a = i * Math.PI / 3;
    g.add(malha(noEixo(anel(5, 0, 18.4), "z"), M.furo, Math.cos(a) * 32, 18 + Math.sin(a) * 32, 0));
  }
  return g;
}

class Helice extends THREE.Curve {
  constructor(raio, passo, voltas, x0, fase) { super(); Object.assign(this, { raio, passo, voltas, x0, fase }); }
  getPoint(t, alvo = new THREE.Vector3()) {
    const a = this.fase + t * this.voltas * 2 * Math.PI;
    return alvo.set(this.x0 + t * this.voltas * this.passo, this.raio * Math.cos(a), this.raio * Math.sin(a));
  }
}

// rosca sem fim de 2 entradas (X, centro em y = -52), com o eixo de entrada vazado e estriado na flange (-X)
function rosca(M) {
  const g = new THREE.Group(), y = -52;
  const c = (r, comp, x, mat) => g.add(malha(cil(r, comp, "x", 32), mat || M.aco, x, y, 0));
  c(10, 30, 57); c(11.5, 56, 15); c(11.5, 14, -27); c(10, 34, -51);
  c(12.5, 50, -93);                                  // eixo de entrada vazado, até a face da flange
  g.add(malha(noEixo(anel(8.5, 0, 1), "x"), M.furo, -118.2, y, 0));
  for (let i = 0; i < 20; i++) {                     // estrias do eixo de entrada
    const a = i * Math.PI / 10;
    g.add(malha(caixa(5, 1.1, 1.1), M.acoEscuro, -116.5, y + Math.sin(a) * 8.6, Math.cos(a) * 8.6));
  }
  [0, Math.PI].forEach((fase) => {                   // filetes da rosca
    const geo = new THREE.TubeGeometry(new Helice(13, 14.6, 3.2, -23, fase), 220, 2.6, 10, false);
    geo.translate(0, y, 0);
    g.add(malha(geo, M.aco));
  });
  return g;
}

function retentor(M, rOut, rIn, larg, eixo, pos) {
  return grupo(malha(noEixo(anel(rOut, rIn, larg), eixo), M.borracha, ...pos),
    malha(noEixo(anel(rOut - 1, rIn + 1.5, larg + 0.4), eixo), M.acoEscuro, ...pos));
}

// tampa aparafusada do eixo de saída (+Z)
function tampaSaida(M) { return grupo(malha(noEixo(anel(51, 25, 9), "z"), M.azulEscuro, 0, 18, 59.5)); }
function parafusosSaida(M) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6, bx = Math.cos(a) * 42, by = 18 + Math.sin(a) * 42;
    g.add(malha(cil(8, 1, "z"), M.usinado, bx, by, 64.4));
    g.add(malha(cil(6, 5.5, "z", 6), M.azulEscuro, bx, by, 67.4));
    g.add(malha(cil(3.4, 18, "z", 12), M.acoEscuro, bx, by, 55));
  }
  return g;
}
// tampa cega preta da rosca (+X)
function tampaCega(M) { return grupo(malha(noEixo(anel(21.5, 0, 2.4), "x"), M.borracha, 79.6, -52, 0)); }
// tampa central da flange (fundo vermelho), com 4 parafusos Allen
function tampaFlange(M) { return grupo(malha(noEixo(anel(37, 17, 1.2, 64), "x"), M.primer, -118, -52, 0)); }
function parafusosFlange(M) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = i * Math.PI / 2 + 0.25, y = -52 + Math.sin(b) * 27, z = Math.cos(b) * 27;
    g.add(malha(cil(4.2, 3, "x", 16), M.parafuso, -119.6, y, z));
    g.add(malha(cil(2.2, 0.6, "x", 6), M.furo, -121.2, y, z));
    g.add(malha(cil(2.4, 14, "x", 12), M.acoEscuro, -111, y, z));
  }
  return g;
}

// respiro de latão (válvula): base sextavada, corpo e tampa
function respiro(M) {
  const g = new THREE.Group();
  g.add(malha(new THREE.CylinderGeometry(10.5, 10.5, 1.2, 24), M.usinado, 0, 0.6, 0));
  g.add(malha(new THREE.CylinderGeometry(8.5, 8.5, 6, 6), M.latao, 0, 4.2, 0));
  g.add(malha(new THREE.CylinderGeometry(6.4, 6.4, 5, 24), M.latao, 0, 9.7, 0));
  g.add(malha(new THREE.CylinderGeometry(5, 5, 1.2, 24), M.acoEscuro, 0, 12.8, 0));
  g.add(malha(new THREE.CylinderGeometry(6, 6, 3.4, 24), M.latao, 0, 15.1, 0));
  return g;
}

// bujão sextavado sobre o assento usinado, com a cabeça apontando para +X ou para baixo
function bujao(M, eixo, r) {
  const g = new THREE.Group();
  const desloca = (geo, d) => { if (eixo === "x") geo.translate(d, 0, 0); else geo.translate(0, -d, 0); return geo; };
  g.add(malha(desloca(noEixo(new THREE.CylinderGeometry(r + 4.5, r + 4.5, 1, 28), eixo), 0.5), M.usinado));
  g.add(malha(desloca(noEixo(new THREE.CylinderGeometry(r + 1.8, r + 1.8, 1.6, 28), eixo), 1.6), M.acoEscuro));
  g.add(malha(desloca(noEixo(new THREE.CylinderGeometry(r, r, 6, 6), eixo), 5.2), M.zinco));
  return g;
}

// etiqueta com o QR Code da ficha (a mesma imagem da etiqueta impressa), colada na carcaça
function etiqueta(M, imagem) {
  const g = new THREE.Group();
  const tex = new THREE.TextureLoader().load(imagem);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; // mantém os quadradinhos nítidos de perto
  // luz própria (emissiveMap = a própria imagem): a etiqueta não fica preta quando a face
  // está de costas para a luz da cena, como acontecia de frente em alguns computadores
  const frente = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0,
    emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.55 });
  const face = new THREE.PlaneGeometry(38, 38);
  face.rotateY(Math.PI / 2); // voltada para +X
  g.add(malha(new THREE.BoxGeometry(0.8, 42, 42), M.zinco, -0.5, 0, 0));
  g.add(malha(face, frente, 0.05, 0, 0));
  return g;
}

// Cada entrada: peça, deslocamento na vista explodida, tag e local. As peças novas são desenhadas já na
// posição de montagem; as antigas (respiro, bujões, etiqueta) recebem a posição.
function montar(M, qr) {
  const L = [];
  const add = (id, obj, pos, desl, tag, local) => {
    obj.position.set(...pos);
    // 0,65: deixa a vista explodida compacta o bastante para a tela do celular
    obj.userData = { peca: id, tag, local, base: new THREE.Vector3(...pos), desl: new THREE.Vector3(...desl).multiplyScalar(0.65) };
    L.push(obj);
  };
  const O = [0, 0, 0];
  add("carcaca", carcaca(M), O, O, "CAR-01", "carcaça");
  add("placa", placa(M), O, [0, 30, 0], "PLC-01", "face de cima, junto ao respiro");
  add("respiro", respiro(M), [5, 89, 34], [0, 70, 0], "RSP-01", "face de cima, junto ao adesivo \"Retire o lacre\"");
  add("nivel", bujao(M, "x", 9), [75, 68, 0], [55, 0, 0], "NIV-01", "face da tampa cega, em cima");
  add("nivel", bujao(M, "x", 8), [75, -22, -34], [55, 0, 0], "NIV-02", "face da tampa cega, no meio");
  add("dreno", bujao(M, "x", 6.5), [75, -82, 0], [55, 0, 0], "DRE-01", "face da tampa cega, embaixo");
  add("dreno", bujao(M, "y", 8), [8, -89, 33], [0, -35, 45], "DRE-02", "base do redutor");
  if (qr) add("etiqueta", etiqueta(M, qr), [76, 62, 33], [90, 0, 30], "QR-01", "face da tampa cega, em cima");
  // eixo de saída: a coroa e o lado da tampa saem para a frente (+Z), o eixo e o lado de trás para trás
  add("coroa", coroa(M), O, [0, 0, 150], "COR-01", "coroa de bronze, no eixo de saída");
  add("chaveta", grupo(malha(caixa(8, 5, 28), M.parafuso, 0, 37.5, 0)), O, [0, 32, 150], "CHV-01", "chaveta entre a coroa e o eixo de saída");
  add("rolamentos-saida", rolamento(M, 31, 17, 14, "z"), [0, 18, 40], [0, 0, 205], "ROL-01", "eixo de saída, lado da tampa aparafusada");
  add("retentores", retentor(M, 22, 17, 3, "z", [0, 18, 63.4]), O, [0, 0, 225], "RET-01", "eixo de saída, lado da tampa aparafusada");
  add("tampas", tampaSaida(M), O, [0, 0, 250], "TMP-01", "tampa aparafusada do eixo de saída");
  add("parafusos", parafusosSaida(M), O, [0, 0, 285], "PAR-01 a PAR-06", "parafusos da tampa TMP-01");
  add("rolamentos-saida", rolamento(M, 31, 17, 14, "z"), [0, 18, -40], [0, 0, -105], "ROL-02", "eixo de saída, lado oposto");
  add("retentores", retentor(M, 22, 17, 3, "z", [0, 18, -60.4]), O, [0, 0, -135], "RET-02", "eixo de saída, lado oposto");
  add("eixo-saida", grupo(malha(noEixo(anel(17, 12, 134), "z"), M.aco, 0, 18, 1.5), malha(caixa(6, 3.4, 134.6), M.furo, 0, 31.2, 1.5)),
    O, [0, 0, -340], "EIX-01", "eixo de saída vazado");
  // rosca sem fim: sai por baixo, com os rolamentos correndo para as pontas
  add("rosca", rosca(M), O, [0, -150, 0], "RSF-01", "rosca sem fim / eixo de entrada");
  add("rolamentos-entrada", rolamento(M, 24, 10, 13, "x"), [62, -52, 0], [45, -150, 0], "ROL-03", "rosca sem fim, lado da tampa cega");
  add("rolamentos-entrada", rolamento(M, 24, 10, 13, "x"), [-60, -52, 0], [-28, -150, 0], "ROL-04", "rosca sem fim, lado da flange do motor");
  add("tampas", tampaCega(M), O, [110, 0, 0], "TMP-02", "tampa cega preta da rosca");
  add("retentores", retentor(M, 17, 12.5, 2.2, "x", [-118.4, -52, 0]), O, [-45, 0, 0], "RET-03", "eixo de entrada, na flange");
  add("tampas", tampaFlange(M), O, [-75, 0, 0], "TMP-03", "tampa central da flange do motor");
  add("parafusos", parafusosFlange(M), O, [-105, 0, 0], "PAR-07 a PAR-10", "parafusos Allen da tampa TMP-03");
  return L;
}

// opcoes.qr = endereço da imagem do QR Code da ficha; sem ela, o modelo fica sem a etiqueta
export function criarVisualizador(caixaEl, opcoes) {
  const qr = opcoes && opcoes.qr;
  return criarBase(caixaEl, opcoes, {
    pecas: qr ? PECAS : PECAS.filter((p) => p.id !== "etiqueta"),
    montar: (M) => montar(M, qr), materiais,
    casca: ["carcaca", "placa", "tampas", "parafusos", "retentores", "nivel", "dreno", "respiro", "etiqueta"]
  });
}
