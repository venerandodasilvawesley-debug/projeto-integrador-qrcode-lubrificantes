// Modelo 3D da bomba centrífuga horizontal de processo (referência ANDRITZ ACP), da bancada didática,
// no mesmo visualizador do redutor (vista explodida, corte, balões e ficha de cada peça).
// Desenhado por código, em medidas aproximadas e ilustrativas: eixo na direção X, bocal de sucção
// para -X (frente), bocal de recalque para cima, motor em +X. As medidas reais devem ser
// conferidas no manual do fabricante.
import * as THREE from "./vendor/three.module.min.js";
import { criarVisualizador as criarBase, anel, noEixo, malha, rolamento } from "./redutor3d.js";

export const PECAS = [
  { id: "carcaca", sigla: "VOL", nome: "Carcaça espiral (voluta)", tipo: "Carcaça em espiral com bocal de sucção axial e bocal de recalque para cima",
    material: "Ferro fundido ou aço inox, conforme o líquido bombeado", qtd: "1",
    espec: "A seção da espiral aumenta até o bocal de recalque, transformando velocidade em pressão.",
    funcao: "Recebe o líquido do rotor e o conduz até o recalque, convertendo energia cinética em pressão.",
    inspecao: "Trincas, vazamento nas juntas e nos flanges, desgaste interno na lingueta (onde a espiral começa).",
    falhas: "Erosão interna por sólidos ou cavitação; trinca por golpe de aríete ou esforço da tubulação nos bocais." },
  { id: "rotor", sigla: "ROT", nome: "Rotor (impulsor) fechado", tipo: "Rotor fechado com pás curvadas para trás",
    material: "Ferro fundido, bronze ou aço inox", qtd: "1", interna: true,
    espec: "Fixado na ponta do eixo por chaveta e porca. A entrada (olho do rotor) fica voltada para a sucção.",
    funcao: "Gira com o eixo e transfere energia ao líquido, aumentando sua velocidade.",
    inspecao: "Erosão, crateras e rugosidade na entrada das pás; desbalanceamento; folga nos anéis de desgaste.",
    falhas: "Erosão por cavitação no lado de baixa pressão das pás, perto do olho do rotor (pequenas crateras); desgaste por abrasão." },
  { id: "anel-desgaste", sigla: "ANE", nome: "Anel de desgaste", tipo: "Anel de folga entre o olho do rotor e a carcaça",
    material: "Bronze ou aço inox", qtd: "1", interna: true,
    espec: "Folga radial pequena (conferir no manual); trocar quando a folga dobrar.",
    funcao: "Reduz a recirculação do líquido do recalque de volta para a sucção.",
    inspecao: "Folga radial na desmontagem.",
    falhas: "Folga aumentada: a bomba perde vazão e pressão e esquenta." },
  { id: "tampa", sigla: "TMP", nome: "Tampa da carcaça", tipo: "Tampa traseira com câmara do selo",
    material: "Ferro fundido ou aço inox", qtd: "1",
    espec: "Permite retirar o conjunto rotativo pela traseira (back pull-out) sem desmontar a tubulação.",
    funcao: "Fecha a carcaça pelo lado do motor e aloja o selo mecânico.",
    inspecao: "Vazamento na junta da tampa.",
    falhas: "Junta danificada ou parafusos frouxos." },
  { id: "selo", sigla: "SEL", nome: "Selo mecânico", tipo: "Selo mecânico simples com mola",
    material: "Faces de carbeto de silício / grafite, elastômeros de vedação", qtd: "1", interna: true,
    espec: "Uma face gira com o eixo e outra fica parada na tampa; o filme de líquido entre elas lubrifica e veda.",
    funcao: "Veda a passagem do eixo, impedindo que o líquido vaze para fora da bomba.",
    inspecao: "Gotejamento pelo selo, aquecimento e ruído.",
    falhas: "Faces trincadas por funcionamento a seco (inclusive com cavitação forte) ou por vibração." },
  { id: "eixo", sigla: "EIX", nome: "Eixo", tipo: "Eixo escalonado com rasgos de chaveta",
    material: "Aço carbono ou aço inox", qtd: "1", interna: true,
    espec: "Leva o rotor numa ponta e o acoplamento na outra; apoiado em dois rolamentos.",
    funcao: "Transmite o torque do motor ao rotor.",
    inspecao: "Empeno, desgaste na região do selo e dos rolamentos.",
    falhas: "Empeno ou fadiga por vibração excessiva e desalinhamento." },
  { id: "rolamentos", sigla: "ROL", nome: "Rolamentos", tipo: "Rolamento rígido de esferas (lado da bomba) e de contato angular (lado do acoplamento)",
    material: "Aço cromo para rolamentos", qtd: "2", interna: true,
    espec: "Designação gravada no anel externo; lubrificação por óleo ou graxa no suporte do mancal.",
    funcao: "Apoiam o eixo e absorvem as cargas radiais e axiais do rotor.",
    inspecao: "Ruído, temperatura e vibração no mancal (onde fica o sensor de vibração).",
    falhas: "Desgaste por vibração da cavitação, desalinhamento ou falta de lubrificação." },
  { id: "suporte", sigla: "MAN", nome: "Suporte do mancal", tipo: "Cavalete com pé de apoio",
    material: "Ferro fundido", qtd: "1",
    espec: "Aloja os rolamentos e o lubrificante; tem visor ou bujão de nível de óleo.",
    funcao: "Sustenta o conjunto rotativo e o alinha com a carcaça.",
    inspecao: "Nível do lubrificante, temperatura e vibração.",
    falhas: "Aquecimento por falta ou excesso de lubrificante." },
  { id: "acoplamento", sigla: "ACO", nome: "Acoplamento", tipo: "Acoplamento elástico (dois cubos e elemento elástico)",
    material: "Cubos de aço ou ferro fundido, elemento elástico de borracha ou poliuretano", qtd: "1",
    espec: "Exige alinhamento motor–bomba dentro da tolerância do fabricante.",
    funcao: "Liga o eixo do motor ao eixo da bomba e absorve pequenos desalinhamentos e choques.",
    inspecao: "Alinhamento e estado do elemento elástico.",
    falhas: "Desalinhamento gera vibração (que pode ser confundida com cavitação) e desgasta o elemento elástico." },
  { id: "protetor", sigla: "PRT", nome: "Protetor do acoplamento", tipo: "Proteção fixa de partes girantes",
    material: "Chapa de aço ou tela, pintada de amarelo", qtd: "1",
    espec: "Só retirar com o equipamento desligado e bloqueado (LOTO).",
    funcao: "Impede contato com o acoplamento girando.",
    inspecao: "Fixação e integridade.",
    falhas: "Proteção retirada e não recolocada após a manutenção." },
  { id: "motor", sigla: "MOT", nome: "Motor elétrico", tipo: "Motor de indução trifásico com carcaça aletada",
    material: "Carcaça de ferro fundido ou alumínio", qtd: "1",
    espec: "Potência e rotação na placa de identificação.",
    funcao: "Aciona a bomba.",
    inspecao: "Corrente, temperatura, ruído e vibração.",
    falhas: "Sobrecarga, aquecimento, rolamentos do motor danificados." },
  { id: "base", sigla: "BAS", nome: "Base", tipo: "Base metálica comum para bomba e motor",
    material: "Aço estrutural", qtd: "1",
    espec: "Deve estar nivelada e bem fixada; apoio firme evita vibração.",
    funcao: "Mantém bomba e motor alinhados e fixados.",
    inspecao: "Parafusos de fixação, trincas e nivelamento.",
    falhas: "Parafusos frouxos ou pé manco geram vibração." },
  { id: "tubulacao", sigla: "TUB", nome: "Tubulação de sucção e recalque", tipo: "Tubos e flanges",
    material: "Aço carbono, inox ou PVC (bancada)", qtd: "2 linhas",
    espec: "Sucção curta, reta e com poucos acessórios; diâmetro igual ou maior que o bocal.",
    funcao: "Leva o líquido até a bomba (sucção) e para o processo (recalque).",
    inspecao: "Filtro da sucção, válvulas, juntas (entrada de ar) e vazamentos.",
    falhas: "Filtro entupido, válvula meio fechada ou entrada de ar na sucção: causas diretas de cavitação." },
  { id: "visor", sigla: "VIS", nome: "Visor de fluxo", tipo: "Trecho transparente na sucção (bancada didática)",
    material: "Acrílico ou vidro", qtd: "1",
    espec: "Permite ver bolhas de vapor ou de ar na sucção durante a demonstração.",
    funcao: "Mostra o escoamento e as bolhas quando a pressão de sucção cai.",
    inspecao: "Bolhas no escoamento indicam cavitação ou entrada de ar.",
    falhas: "Trinca ou vazamento nas conexões." },
  { id: "sensor-vibracao", sigla: "SVB", nome: "Sensor de vibração", tipo: "Acelerômetro (ex.: MPU6050 ou ADXL345 na bancada)",
    material: "Corpo metálico, fixado por parafuso ou ímã", qtd: "1",
    espec: "No suporte do mancal, perto do rolamento do lado da bomba.",
    funcao: "Mede a vibração em mm/s e envia ao painel e ao celular do mecânico.",
    inspecao: "Fixação firme e cabo íntegro.",
    falhas: "Sensor solto mede vibração errada." },
  { id: "sensor-pressao", sigla: "SPR", nome: "Sensor de pressão", tipo: "Transmissor de pressão",
    material: "Aço inox", qtd: "1",
    espec: "No recalque (como na bancada de referência); para cavitação, o ideal é medir também a sucção.",
    funcao: "Mede a pressão e indica queda de desempenho da bomba.",
    inspecao: "Conexão sem vazamento e leitura coerente com o manômetro.",
    falhas: "Tomada de pressão entupida." },
  { id: "sensor-temperatura", sigla: "STE", nome: "Sensor de temperatura", tipo: "Sensor de contato (ex.: DS18B20 na bancada)",
    material: "Ponta de aço inox", qtd: "1",
    espec: "Na carcaça da bomba.",
    funcao: "Acompanha a temperatura: líquido quente cavita com mais facilidade.",
    inspecao: "Contato firme com a carcaça.",
    falhas: "Mau contato mede temperatura mais baixa que a real." }
];

const PI = Math.PI;

function materiais() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  return {
    azul: m({ color: 0x1f5fbf, roughness: 0.45, metalness: 0.15 }),
    rotor: m({ color: 0xc63b2b, roughness: 0.4, metalness: 0.3 }),
    amarelo: m({ color: 0xf2c200, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide }),
    base: m({ color: 0x5f6870, roughness: 0.6, metalness: 0.4 }),
    vidro: m({ color: 0xcfe9ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false }),
    bolha: m({ color: 0xffffff, roughness: 0.2, metalness: 0 }),
    sensorVerde: m({ color: 0x1c8a45, roughness: 0.5, metalness: 0.1 }),
    sensorAzul: m({ color: 0x1565c0, roughness: 0.5, metalness: 0.1 }),
    sensorVermelho: m({ color: 0xc22525, roughness: 0.5, metalness: 0.1 })
  };
}

// contorno da espiral no plano (r aumenta de 52 a 70 numa volta)
function espiral(furo) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = i / 64 * 2 * PI, r = 52 + 18 * i / 64;
    if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r * Math.cos(a), r * Math.sin(a));
  }
  s.closePath();
  if (furo) { const h = new THREE.Path(); h.absarc(0, 0, furo, 0, 2 * PI, true); s.holes.push(h); }
  return s;
}
// extruda um contorno do plano YZ ao longo de X (de x0 a x0 + largura)
function aoLongoDeX(shape, x0, largura) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: largura, bevelEnabled: false, curveSegments: 48 });
  g.rotateY(PI / 2);
  g.translate(x0, 0, 0);
  return g;
}

function carcaca(M) {
  const g = new THREE.Group();
  g.add(malha(aoLongoDeX(espiral(46), -20, 40), M.azul));        // espiral
  g.add(malha(aoLongoDeX(espiral(13), -24, 4), M.azul));         // parede da frente (olho da sucção)
  g.add(malha(aoLongoDeX(espiral(42), 20, 4), M.azul));          // parede de trás
  g.add(malha(noEixo(anel(16, 13, 46), "x"), M.azul, -47, 0, 0));  // bocal de sucção
  g.add(malha(noEixo(anel(26, 13, 5), "x"), M.azul, -72.5, 0, 0)); // flange da sucção
  g.add(malha(anel(15, 12, 56), M.azul, 0, 78, 0));              // bocal de recalque
  g.add(malha(anel(24, 12, 5), M.azul, 0, 108.5, 0));            // flange do recalque
  g.add(malha(new THREE.BoxGeometry(30, 14, 70), M.azul, 0, -67, 0)); // pé
  return g;
}

// pá curvada para trás, extrudada ao longo de X
function pa(a0) {
  const s = new THREE.Shape(), n = 12, cima = [], baixo = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, r = 14 + 25 * t, a = a0 + 1.1 * t, d = 1.4 / r;
    cima.push([r * Math.cos(a + d), r * Math.sin(a + d)]); baixo.push([r * Math.cos(a - d), r * Math.sin(a - d)]);
  }
  cima.concat(baixo.reverse()).forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  return aoLongoDeX(s, -6.5, 13);
}
function rotor(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(40, 0, 3), "x"), M.rotor, 8, 0, 0));    // disco traseiro
  g.add(malha(noEixo(anel(40, 13, 3), "x"), M.rotor, -8, 0, 0));  // disco dianteiro (olho)
  for (let i = 0; i < 6; i++) g.add(malha(pa(i * PI / 3), M.rotor));
  g.add(malha(noEixo(anel(9, 0, 22), "x"), M.rotor, 7, 0, 0));    // cubo
  g.add(malha(noEixo(new THREE.CylinderGeometry(5, 7, 6, 6), "x"), M.acoEscuro, -6, 0, 0)); // porca do rotor
  return g;
}

function selo(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(15, 8.4, 3), "x"), M.acoEscuro, -4.5, 0, 0));
  g.add(malha(noEixo(anel(14, 8.4, 3), "x"), M.borracha, -1.5, 0, 0));
  const mola = new THREE.TorusGeometry(11, 1, 8, 32);
  for (let i = 0; i < 3; i++) { const o = malha(mola.clone(), M.aco, 1.5 + i * 2, 0, 0); o.rotation.y = PI / 2; g.add(o); }
  g.add(malha(noEixo(anel(14, 8.4, 3), "x"), M.aco, 8, 0, 0));
  return g;
}

function eixo(M) {
  const g = new THREE.Group(), cil = (r, x0, x1) => g.add(malha(noEixo(new THREE.CylinderGeometry(r, r, x1 - x0, 32), "x"), M.aco, (x0 + x1) / 2, 0, 0));
  cil(7, -4, 50); cil(10, 50, 140); cil(8, 140, 186);
  g.add(malha(new THREE.BoxGeometry(30, 1, 3), M.furo, 170, 7.6, 0)); // rasgo de chaveta do acoplamento
  return g;
}

function tampa(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(50, 9, 6), "x"), M.azul, 27, 0, 0));
  g.add(malha(noEixo(anel(22, 16, 16), "x"), M.azul, 38, 0, 0)); // câmara do selo
  return g;
}

function suporte(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(40, 16, 6), "x"), M.azul, 49, 0, 0));
  g.add(malha(noEixo(anel(28, 21, 88), "x"), M.azul, 96, 0, 0));
  g.add(malha(noEixo(anel(30, 11, 6), "x"), M.azul, 140, 0, 0));
  g.add(malha(new THREE.BoxGeometry(56, 46, 46), M.azul, 100, -50, 0)); // pé
  g.add(malha(noEixo(anel(5, 0, 1), "z"), M.furo, 100, -16, 28.6));    // visor do nível de óleo
  return g;
}

function acoplamento(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(20, 8, 14), "x"), M.acoEscuro, 158, 0, 0));
  g.add(malha(noEixo(anel(19, 9, 6), "x"), M.borracha, 168, 0, 0));
  g.add(malha(noEixo(anel(20, 8, 14), "x"), M.acoEscuro, 178, 0, 0));
  return g;
}

function protetor(M) {
  const g = new THREE.Group();
  const casca = new THREE.CylinderGeometry(32, 32, 44, 28, 1, true, PI, PI);
  casca.rotateZ(-PI / 2);
  g.add(malha(casca, M.amarelo, 168, 0, 0));
  // rasgos da tela
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    const a = PI * (0.18 + j * 0.16), slot = new THREE.BoxGeometry(6, 0.6, 5);
    const o = malha(slot, M.furo, 154 + i * 9, 32.2 * Math.sin(a), 32.2 * Math.cos(a));
    o.lookAt(o.position.x, 0, 0); o.rotateX(PI / 2); // lado fino voltado para o eixo
    g.add(o);
  }
  g.add(malha(new THREE.BoxGeometry(44, 4, 66), M.amarelo, 168, -33, 0));
  return g;
}

function motor(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(44, 0, 118), "x"), M.azul, 255, 0, 0));
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * 2 * PI;
    if (Math.sin(a) < -0.7) continue; // sem aletas embaixo, onde ficam os pés
    const o = malha(new THREE.BoxGeometry(110, 5, 1.6), M.azul, 255, 46 * Math.sin(a), 46 * Math.cos(a));
    o.rotation.x = -a; g.add(o);
  }
  g.add(malha(noEixo(anel(42, 9, 6), "x"), M.azul, 194, 0, 0));    // tampa dianteira
  g.add(malha(noEixo(anel(43, 0, 22), "x"), M.azul, 325, 0, 0));   // tampa do ventilador
  g.add(malha(noEixo(anel(34, 0, 0.6), "x"), M.furo, 336.4, 0, 0)); // grade do ventilador
  g.add(malha(noEixo(new THREE.CylinderGeometry(8, 8, 10, 24), "x"), M.aco, 187, 0, 0)); // ponta do eixo do motor
  g.add(malha(new THREE.BoxGeometry(34, 18, 34), M.azul, 250, 53, 0));  // caixa de ligação
  [215, 295].forEach((x) => g.add(malha(new THREE.BoxGeometry(22, 34, 76), M.azul, x, -57, 0))); // pés
  return g;
}

function base(M) {
  const g = new THREE.Group();
  g.add(malha(new THREE.BoxGeometry(470, 8, 150), M.base, 110, -78, 0));
  return g;
}

function tubulacao(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(anel(15, 12, 26), "x"), M.azul, -146, 0, 0));
  g.add(malha(noEixo(anel(15, 12, 23), "x"), M.azul, -88.5, 0, 0));
  g.add(malha(noEixo(anel(26, 12, 5), "x"), M.azul, -77.5, 0, 0));   // flange que encosta na sucção
  g.add(malha(anel(24, 12, 5), M.azul, 0, 113.5, 0));                 // flange do recalque
  g.add(malha(anel(15, 12, 50), M.azul, 0, 141, 0));                  // tubo do recalque
  return g;
}

function visor(M) {
  const g = new THREE.Group();
  g.add(malha(noEixo(new THREE.CylinderGeometry(15, 15, 30, 32, 1, true), "x"), M.vidro, -115, 0, 0));
  [-131, -99].forEach((x) => g.add(malha(noEixo(anel(19, 12, 3), "x"), M.acoEscuro, x, 0, 0)));
  [[-122, 6, 4, 2.4], [-114, -5, -6, 1.8], [-108, 3, 8, 2], [-118, -2, 9, 1.4], [-104, -7, 1, 2.2], [-126, 8, -5, 1.6]]
    .forEach((b) => g.add(malha(new THREE.SphereGeometry(b[3], 12, 8), M.bolha, b[0], b[1], b[2])));
  return g;
}

function sensor(M, cor, eixo) {
  // corpo, sextavado e conector, apontando no sentido +eixo
  const g = new THREE.Group();
  g.add(malha(new THREE.CylinderGeometry(5, 5, 4, 6), M.acoEscuro, 0, 2, 0));
  g.add(malha(new THREE.CylinderGeometry(4.2, 4.2, 12, 20), M.aco, 0, 10, 0));
  g.add(malha(new THREE.CylinderGeometry(4.6, 4.6, 3, 20), cor, 0, 17.5, 0));
  g.add(malha(new THREE.CylinderGeometry(2.6, 2.6, 7, 16), M.borracha, 0, 22.5, 0));
  if (eixo === "z") g.rotation.x = PI / 2;
  return g;
}

function montar(M) {
  const L = [];
  const add = (id, obj, desl, tag, local, pos) => {
    pos = pos || [0, 0, 0];
    obj.position.set(...pos);
    obj.userData = { peca: id, tag, local, base: new THREE.Vector3(...pos), desl: new THREE.Vector3(...desl) };
    L.push(obj);
  };
  add("base", base(M), [0, -40, 0], "BAS-01", "base comum bomba e motor");
  add("carcaca", carcaca(M), [0, 0, 0], "VOL-01", "carcaça espiral com bocais de sucção e recalque");
  add("tubulacao", tubulacao(M), [-70, 50, 0], "TUB-01", "tubulação de sucção (frente) e de recalque (em cima)");
  add("visor", visor(M), [-70, 50, 0], "VIS-01", "visor de fluxo na sucção");
  add("anel-desgaste", malha(noEixo(anel(16, 13.5, 6), "x"), M.bronze), [40, 0, 110], "ANE-01", "anel de desgaste no olho do rotor", [-21, 0, 0]);
  add("rotor", rotor(M), [110, 0, 110], "ROT-01", "rotor fechado de 6 pás");
  add("tampa", tampa(M), [90, 0, 0], "TMP-01", "tampa traseira da carcaça");
  add("selo", selo(M), [170, 0, 110], "SEL-01", "selo mecânico na câmara da tampa", [36, 0, 0]);
  add("eixo", eixo(M), [200, 0, 110], "EIX-01", "eixo da bomba");
  add("rolamentos", rolamento(M, 20, 10, 12, "x"), [200, 0, 110], "ROL-01", "rolamento do lado da bomba", [62, 0, 0]);
  add("rolamentos", rolamento(M, 20, 10, 12, "x"), [200, 0, 110], "ROL-02", "rolamento do lado do acoplamento", [130, 0, 0]);
  add("suporte", suporte(M), [200, 0, 0], "MAN-01", "suporte do mancal");
  add("sensor-vibracao", sensor(M, M.sensorVerde, "y"), [200, 40, 0], "SVB-01", "sensor de vibração no mancal", [118, 28, 0]);
  add("acoplamento", acoplamento(M), [300, 0, 0], "ACO-01", "acoplamento elástico motor–bomba");
  add("protetor", protetor(M), [300, 90, 0], "PRT-01", "protetor do acoplamento");
  add("motor", motor(M), [340, 0, 0], "MOT-01", "motor elétrico");
  add("sensor-pressao", sensor(M, M.sensorAzul, "z"), [-70, 50, 40], "SPR-01", "sensor de pressão no recalque", [0, 135, 12]);
  add("sensor-temperatura", sensor(M, M.sensorVermelho, "z"), [0, 0, 50], "STE-01", "sensor de temperatura na carcaça", [0, -12, 60]);
  return L;
}

const MODELO = { pecas: PECAS, montar, materiais,
  casca: ["carcaca", "tampa", "suporte", "protetor", "tubulacao", "visor"] };

export function criarVisualizador(caixa, opcoes) {
  return criarBase(caixa, opcoes, MODELO);
}
