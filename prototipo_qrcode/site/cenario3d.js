// Cenário 3D: um dia de lubrificação na fábrica (fictícia). O lubrificador vai até o redutor RED-001, que aciona
// a esteira que leva casca de eucalipto para a queima na caldeira, lê o QR Code e faz a troca do óleo seguindo a ficha.
// Tudo em milímetros, como o modelo do redutor. Eixo X = ao longo da esteira, Z = para o corredor.
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";
import { criarModelo } from "./redutor_oficina3d.js";

const QR = "/fotos/qr-lubrificacao-RED-001.png";
const N_CASCA = 420, R_TAMBOR = 120, RPM_SAIDA = 70;  // 70 rpm na saída do redutor, como na placa
const VEL_ESTEIRA = RPM_SAIDA / 60 * 2 * Math.PI * R_TAMBOR;
const POS_RED = new THREE.Vector3(2000, 900 - 18, 560);  // saída do redutor alinhada ao tambor

const caixaEl = document.getElementById("cena");
const cena = new THREE.Scene();
cena.background = new THREE.Color(0xaab4bc);
cena.fog = new THREE.Fog(0xaab4bc, 16000, 42000);
const camera = new THREE.PerspectiveCamera(38, 1, 30, 60000);
const render = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
render.shadowMap.enabled = true;
render.shadowMap.type = THREE.PCFSoftShadowMap;
caixaEl.appendChild(render.domElement);

cena.add(new THREE.HemisphereLight(0xffffff, 0x8a8f94, 1.7));
const sol = new THREE.DirectionalLight(0xfff4e0, 2.1);
sol.position.set(-5000, 11000, 7000);
sol.target.position.set(0, 0, 500);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -9000, right: 7000, top: 7000, bottom: -5000, near: 1000, far: 26000 });
sol.shadow.bias = -0.0006;
cena.add(sol, sol.target);

const controles = new OrbitControls(camera, render.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.maxPolarAngle = Math.PI * 0.495;
controles.minDistance = 180;
controles.maxDistance = 22000;

// ---------- auxiliares ----------
const mat = (color, roughness, metalness, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: roughness ?? 0.7, metalness: metalness ?? 0.05 }, extra));
function sombra(o, recebe) { o.castShadow = true; o.receiveShadow = !!recebe; return o; }
function bloco(pai, w, h, d, m, x, y, z, semSombra) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  if (!semSombra) sombra(o, true);
  pai.add(o);
  return o;
}
function tubo(pai, r, c, m, eixo, x, y, z, lados, r2) {
  const g = new THREE.CylinderGeometry(r2 ?? r, r, c, lados || 20);
  if (eixo === "x") g.rotateZ(Math.PI / 2);
  if (eixo === "z") g.rotateX(Math.PI / 2);
  const o = sombra(new THREE.Mesh(g, m));
  o.position.set(x, y, z);
  pai.add(o);
  return o;
}
function textura(l, a, desenha, repX, repY) {
  const c = document.createElement("canvas");
  c.width = l; c.height = a;
  desenha(c.getContext("2d"), l, a);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repX) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repX, repY); }
  return t;
}
function placaTexto(pai, linhas, fundo, cor, w, h, x, y, z, rotY) {
  const t = textura(512, Math.round(512 * h / w), (g, l, a) => {
    g.fillStyle = fundo; g.fillRect(0, 0, l, a);
    g.fillStyle = cor; g.textAlign = "center"; g.textBaseline = "middle";
    linhas.forEach((tx, i) => {
      g.font = "700 " + Math.round(a / (linhas.length + 1.2)) + "px Arial";
      g.fillText(tx, l / 2, a * (i + 1) / (linhas.length + 1));
    });
  });
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
  o.position.set(x, y, z);
  o.rotation.y = rotY || 0;
  pai.add(o);
  return o;
}

// ---------- galpão ----------
function galpao() {
  const piso = textura(512, 512, (g, l, a) => {
    g.fillStyle = "#8f9498"; g.fillRect(0, 0, l, a);
    for (let i = 0; i < 7000; i++) {
      const v = 120 + Math.random() * 50 | 0;
      g.fillStyle = `rgba(${v},${v},${v + 4},.28)`;
      g.fillRect(Math.random() * l, Math.random() * a, 2, 2);
    }
    g.strokeStyle = "#74797d"; g.lineWidth = 3; g.strokeRect(0, 0, l, a);
  }, 7, 5);
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(35000, 25000), mat(0xffffff, 0.85, 0, { map: piso }));
  chao.rotation.x = -Math.PI / 2;
  chao.position.set(-1500, 0, 1500);
  chao.receiveShadow = true;
  cena.add(chao);

  // corredor de pedestres, com faixas amarelas
  const amarelo = mat(0xf0c419, 0.6);
  [1000 + 150, 2150].forEach((z) => bloco(cena, 18000, 4, 90, amarelo, -1500, 3, z, true));
  [3350, 1850].forEach((x) => bloco(cena, 90, 4, 1000, amarelo, x + 1200, 3, 1650, true));
  for (let x = -9500; x < 5000; x += 3000) {
    placaSeta(x);
  }
  function placaSeta(x) {
    const s = new THREE.Shape();
    s.moveTo(-260, -60); s.lineTo(60, -60); s.lineTo(60, -150); s.lineTo(270, 0); s.lineTo(60, 150); s.lineTo(60, 60); s.lineTo(-260, 60); s.closePath();
    const o = new THREE.Mesh(new THREE.ShapeGeometry(s), amarelo);
    o.rotation.x = -Math.PI / 2;
    o.position.set(x, 4, 1650);
    cena.add(o);
  }

  const parede = textura(256, 256, (g, l, a) => {
    g.fillStyle = "#c4ccd2"; g.fillRect(0, 0, l, a);
    for (let x = 0; x < l; x += 32) { g.fillStyle = "#adb6bd"; g.fillRect(x, 0, 9, a); }
  }, 18, 3);
  const mp = mat(0xffffff, 0.75, 0.1, { map: parede, side: THREE.DoubleSide });
  const painel = (w, h, x, y, z, ry) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mp); o.position.set(x, y, z); o.rotation.y = ry; o.receiveShadow = true; cena.add(o); };
  painel(35000, 9000, -1500, 4500, -9500, 0);
  painel(25000, 9000, -19000, 4500, 1500, Math.PI / 2);
  painel(25000, 9000, 16000, 4500, 1500, -Math.PI / 2);
  bloco(cena, 35000, 900, 12, mat(0xdff2ff, 0.2, 0, { emissive: 0xcfe9ff, emissiveIntensity: 0.9 }), -1500, 6900, -9480, true);  // janelas altas

  // pilares, tesouras e luminárias
  const azulAco = mat(0x3f5f7a, 0.55, 0.4), cinzaAco = mat(0x717a82, 0.6, 0.5);
  for (let x = -17000; x <= 15000; x += 6000) {
    [-9000, 7600].forEach((z) => {
      if (Math.abs(z) > 0) { bloco(cena, 300, 8200, 300, azulAco, x, 4100, z); bloco(cena, 310, 1000, 310, mat(0xf0c419, 0.6), x, 500, z, true); }
    });
    bloco(cena, 180, 240, 16800, cinzaAco, x, 8100, -700, true);
    if (x < 15000) for (const z of [-6500, -1500, 2500]) {
      bloco(cena, 1200, 80, 300, mat(0xffffff, 0.3, 0, { emissive: 0xffffff, emissiveIntensity: 1.2 }), x + 3000, 7500, z, true);
    }
  }
  bloco(cena, 35000, 200, 120, cinzaAco, -1500, 8000, -700, true);

  // fundo: tanques e tubulação
  const inox = mat(0xbcc4ca, 0.32, 0.75);
  [[-13500, -6800], [-10000, -6800], [-6500, -6800]].forEach(([x, z]) => {
    tubo(cena, 1500, 6000, inox, "y", x, 3000, z, 40);
    tubo(cena, 1500, 360, inox, "y", x, 6180, z, 40, 900);
  });
  tubo(cena, 90, 26000, mat(0x2d7fb8, 0.5, 0.3), "x", -3000, 6300, -8700);
  tubo(cena, 60, 26000, mat(0xd1542b, 0.5, 0.3), "x", -3000, 6050, -8700);
  tubo(cena, 75, 26000, mat(0x4f8f4c, 0.5, 0.3), "x", -3000, 5800, -8700);

  // segurança na parede e no pilar
  placaTexto(cena, ["USO OBRIGATÓRIO", "CAPACETE · ÓCULOS · LUVAS"], "#1958a8", "#fff", 2400, 1000, 300, 3000, -9470, 0);
  placaTexto(cena, ["FÁBRICA DE CELULOSE", "CENÁRIO DIDÁTICO"], "#627c42", "#fff", 5000, 1400, -2800, 4300, -9470, 0);
  const ext = new THREE.Group(); ext.position.set(3950, 0, 2300); cena.add(ext);
  tubo(ext, 85, 520, mat(0xc71f1f, 0.4, 0.2), "y", 0, 950, 0, 20);
  bloco(ext, 340, 340, 12, mat(0xc71f1f, 0.5), 0, 1560, 20, true);
}

// ---------- caldeira de biomassa ----------
function caldeira() {
  const g = new THREE.Group(); cena.add(g);
  const chapa = mat(0x6f7b85, 0.6, 0.45), isol = mat(0xb9bfc4, 0.7, 0.2), ferrugem = mat(0x7d4a2d, 0.8, 0.2), vermelho = mat(0xb5462a, 0.5, 0.3);
  bloco(g, 7200, 6400, 3800, isol, 4200, 3200, -4300);
  bloco(g, 7300, 500, 3900, chapa, 4200, 6650, -4300);
  for (let x = 900; x <= 7500; x += 1100) bloco(g, 120, 6400, 80, chapa, x, 3200, -2370);
  tubo(g, 520, 7000, ferrugem, "y", 6400, 10300, -4300, 28, 420);
  tubo(g, 180, 3300, vermelho, "y", 1900, 8000, -3400);
  tubo(g, 180, 2600, vermelho, "x", 3100, 7500, -3400);
  placaTexto(g, ["CALDEIRA DE BIOMASSA"], "#7d2f1a", "#fff", 4400, 520, 4200, 5400, -2325);
  // porta de inspeção com o fogo da queima
  bloco(g, 1500, 1200, 90, chapa, 4800, 1500, -2370);
  fogo = bloco(g, 1000, 760, 20, mat(0x331000, 0.6, 0, { emissive: 0xff6a12, emissiveIntensity: 1.6 }), 4800, 1500, -2315, true);
  // calha: recebe a casca na ponta da esteira e desce até a boca de alimentação
  const c = new THREE.Group(); g.add(c);
  const cx = 2190, ini = new THREE.Vector3(cx, 860, 0), fimC = new THREE.Vector3(cx, 620, -2350);
  const comp = ini.distanceTo(fimC);
  const calha = bloco(c, 640, 420, comp, chapa, cx, (ini.y + fimC.y) / 2, ini.z / 2 + fimC.z / 2);
  calha.rotation.x = Math.atan2(ini.y - fimC.y, comp) * -1;
  bloco(c, 760, 760, 760, chapa, cx, 900, -60);
  [-700, -1500].forEach((z) => bloco(c, 90, 700, 90, chapa, cx, 350, z));
  bloco(c, 900, 900, 300, vermelho, cx, 640, -2400);
}

// ---------- esteira, redutor, painel e carrinho ----------
let correia, tambores = [], cascas, cascaX = [], fogo;
let redutor, respiro, dreno, lacre, luzVerde, luzVermelha, cadeado;
function esteira() {
  const X0 = -5000, X1 = 2000, Y = 900, L = X1 - X0, g = new THREE.Group();
  cena.add(g);
  const aco = mat(0x47576a, 0.55, 0.4), tinta = mat(0x2f6d4e, 0.55, 0.2), cinza = mat(0x9099a1, 0.4, 0.7);
  [-440, 440].forEach((z) => bloco(g, L + 240, 150, 40, tinta, (X0 + X1) / 2, Y, z));
  for (let x = X0 + 200; x <= X1 - 150; x += 1600) [-440, 440].forEach((z) => bloco(g, 80, Y - 80, 80, aco, x, (Y - 80) / 2, z));
  for (let x = X0 + 200; x < X1; x += 400) tubo(g, 42, 800, cinza, "z", x, Y + 60, 0, 14);

  const nervura = textura(128, 128, (c, l, a) => {
    c.fillStyle = "#23282c"; c.fillRect(0, 0, l, a);
    c.fillStyle = "#3a4147"; c.fillRect(0, 0, 26, a);
  }, 26, 2);
  correia = new THREE.Mesh(new THREE.BoxGeometry(L, 12, 780), [0, 1, 2, 3, 4, 5].map((i) => i === 2 ? mat(0xffffff, 0.8, 0, { map: nervura }) : mat(0x23282c, 0.8)));
  correia.position.set((X0 + X1) / 2, Y + R_TAMBOR - 6, 0);
  sombra(correia, true);
  g.add(correia);
  bloco(g, L, 10, 780, mat(0x23282c, 0.8), (X0 + X1) / 2, Y - R_TAMBOR, 0);

  // tambores: a saída do redutor aciona o da direita
  const riscos = textura(128, 64, (c, l, a) => { c.fillStyle = "#59636b"; c.fillRect(0, 0, l, a); c.fillStyle = "#30363b"; c.fillRect(0, 0, 18, a); }, 4, 1);
  [X0, X1].forEach((x) => {
    const d = new THREE.Group(); d.position.set(x, Y, 0); g.add(d);
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(R_TAMBOR, R_TAMBOR, 780, 32).rotateX(Math.PI / 2), mat(0xffffff, 0.5, 0.5, { map: riscos }));
    sombra(tb); d.add(tb); tambores.push(d);
  });
  tubo(tambores[1], 14, 1040, mat(0xc3c9cf, 0.3, 0.85), "z", 0, 0, 5);
  tubo(tambores[0], 22, 1000, mat(0xc3c9cf, 0.3, 0.85), "z", 0, 0, 0);
  bloco(g, 120, 120, 70, mat(0x2b3138, 0.5, 0.4), X1, Y, -474);     // mancal do outro lado
  [-474, 474].forEach((z) => bloco(g, 120, 120, 70, mat(0x2b3138, 0.5, 0.4), X0, Y, z));
  bloco(g, 120, 120, 70, mat(0x2b3138, 0.5, 0.4), X1, Y, 470);

  // capelas nas duas pontas: a casca entra numa e sai na outra, para a calha da caldeira
  const capela = mat(0xd9dde0, 0.6, 0.25);
  [[X0 + 400, 1100], [X1 - 280, 900]].forEach(([x, c]) => {
    const h = 900;
    bloco(g, c, 40, 860, capela, x, Y + 120 + h, 0);
    [-430, 430].forEach((z) => bloco(g, c, h, 16, capela, x, Y + 120 + h / 2, z));
  });
  placaTexto(g, ["TRANSPORTADOR DE CASCA"], "#2f6d4e", "#fff", 2600, 130, -2000, Y + 22, 462);
  // casca de eucalipto sobre a correia: camada de lascas que anda com a esteira
  const lasca = new THREE.BoxGeometry(150, 26, 42);
  const tonsCasca = [0x6b4a2e, 0x8a6240, 0x57402c, 0x9c7a55];
  cascas = new THREE.InstancedMesh(lasca, mat(0xffffff, 0.95, 0), N_CASCA);
  const cor = new THREE.Color();
  for (let i = 0; i < N_CASCA; i++) {
    cascaX.push({ x: X0 + 300 + Math.random() * 6500, z: (Math.random() - 0.5) * 620, y: Y + R_TAMBOR + 14 + Math.random() * 70, a: Math.random() * 3.1, b: (Math.random() - 0.5) * 0.5 });
    cascas.setColorAt(i, cor.set(tonsCasca[i % 4]));
  }
  cascas.castShadow = true;
  cascas.frustumCulled = false;
  g.add(cascas);
  // pilha de casca do pátio, antes da esteira
  const monte = new THREE.Mesh(new THREE.ConeGeometry(2100, 1700, 9, 3), mat(0x6e4e32, 1, 0, { flatShading: true }));
  monte.position.set(-6900, 850, 0);
  sombra(monte, true);
  cena.add(monte);

  // redutor real do site, com o QR da ficha na face de cima
  redutor = criarModelo(QR);
  redutor.position.copy(POS_RED);
  redutor.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  cena.add(redutor);
  respiro = redutor.children.find((o) => o.userData.tag === "RSP-01");
  dreno = redutor.children.find((o) => o.userData.tag === "DRE-01");

  // suporte do conjunto e motor no flange (-X)
  const suporte = mat(0x56616b, 0.55, 0.4), yR = POS_RED.y;
  bloco(cena, 152, 14, 130, suporte, 2000, yR - 103, 560);
  bloco(cena, 90, yR - 110, 90, suporte, 2000, (yR - 110) / 2, 560);
  const motor = new THREE.Group();
  motor.position.set(POS_RED.x - 135, yR - 52, POS_RED.z);
  cena.add(motor);
  const mm = mat(0x2f6d9e, 0.55, 0.2);
  tubo(motor, 95, 300, mm, "x", -150, 0, 0, 30);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; bloco(motor, 280, 6, 6, mm, -150, Math.sin(a) * 97, Math.cos(a) * 97, true); }
  tubo(motor, 110, 12, mm, "x", -8, 0, 0, 30);
  tubo(motor, 96, 60, mat(0x2b3138, 0.6, 0.3), "x", -325, 0, 0, 30);
  bloco(motor, 110, 80, 110, mm, -170, 130, 0);
  bloco(cena, 60, yR - 190, 60, suporte, POS_RED.x - 300, (yR - 190) / 2, POS_RED.z);

  // painel de comando, no pilar ao lado do corredor
  const p = new THREE.Group(); p.position.set(3300, 0, 2230); p.rotation.y = Math.PI; cena.add(p);
  bloco(p, 100, 2300, 100, mat(0x56616b, 0.55, 0.4), 0, 1150, 80);
  bloco(p, 520, 700, 200, mat(0x9aa3aa, 0.5, 0.3), 0, 1500, 0);
  placaTexto(p, ["ESTEIRA · CCM-01"], "#222", "#fff", 400, 70, 0, 1760, 101);
  luzVerde = tubo(p, 26, 20, mat(0x1c5a2e, 0.4, 0, { emissive: 0x25d366, emissiveIntensity: 1.4 }), "z", -130, 1640, 104);
  luzVermelha = tubo(p, 26, 20, mat(0x5a1c1c, 0.4, 0, { emissive: 0xff2a2a, emissiveIntensity: 0 }), "z", 130, 1640, 104);
  tubo(p, 34, 30, mat(0xc71f1f, 0.4), "z", 0, 1500, 104);
  bloco(p, 56, 150, 30, mat(0x22262a, 0.5), 0, 1320, 112);
  cadeado = new THREE.Group(); cadeado.position.set(0, 1250, 130); cadeado.visible = false; p.add(cadeado);
  bloco(cadeado, 70, 60, 26, mat(0xd42020, 0.4, 0.2), 0, 0, 0);
  const arco = new THREE.Mesh(new THREE.TorusGeometry(24, 5, 8, 16, Math.PI), mat(0xc3c9cf, 0.3, 0.8)); arco.position.y = 30; cadeado.add(arco);
  placaTexto(cadeado, ["PERIGO", "NÃO LIGUE"], "#c71f1f", "#fff", 130, 90, 0, -90, 16);

  // carrinho de lubrificação, com os galões identificados por cor
  const k = new THREE.Group(); k.position.set(3300, 0, 300); cena.add(k);
  [240, 720].forEach((y) => bloco(k, 800, 24, 500, mat(0x3f4a54, 0.55, 0.4), 0, y, 0));
  [[-390, -240], [390, -240], [-390, 240], [390, 240]].forEach(([x, z]) => {
    bloco(k, 22, 960, 22, mat(0x3f4a54, 0.55, 0.4), x, 560, z);
    tubo(k, 55, 28, mat(0x1b1e21, 0.8), "z", x, 55, z, 16);
  });
  [[-240, 0x2d7fb8], [0, 0xe8791c], [240, 0x4f8f4c]].forEach(([x, cor], i) => {
    if (i === 1) { galao = criaGalao(cor); galao.position.set(x, 732, 0); k.add(galao); return; }
    const o = criaGalao(cor); o.position.set(x, 732, 0); k.add(o);
  });
  carrinho = k;
  // balde para o óleo usado, embaixo do dreno
  balde = new THREE.Group(); balde.position.set(POS_RED.x + 95, 0, POS_RED.z); cena.add(balde);
  tubo(balde, 150, 300, mat(0x2f3338, 0.6, 0.3, { side: THREE.DoubleSide }), "y", 0, 150, 0, 24, 175);
  nivelBalde = tubo(balde, 150, 6, mat(0x3a2a12, 0.25, 0.1), "y", 0, 20, 0, 24);
  balde.visible = false;

  // jatos de óleo
  jatoDreno = tubo(cena, 7, 1, mat(0x3a2a12, 0.2, 0.1), "y", POS_RED.x + 95, 0, POS_RED.z, 10);
  jatoEnche = tubo(cena, 7, 1, mat(0xe2a63c, 0.15, 0.1, { transparent: true, opacity: 0.85 }), "y", 0, 0, 0, 10);
  jatoDreno.visible = jatoEnche.visible = false;
  funil = new THREE.Group();
  funil.position.copy(POS_RED).add(new THREE.Vector3(5, 110, 34));
  tubo(funil, 12, 70, mat(0xd8d8d0, 0.5, 0.1, { side: THREE.DoubleSide }), "y", 0, 60, 0, 18, 60);
  tubo(funil, 9, 40, mat(0xd8d8d0, 0.5, 0.1), "y", 0, 10, 0, 12);
  funil.visible = false;
  cena.add(funil);
}
let galao, carrinho, balde, nivelBalde, jatoDreno, jatoEnche, funil;

function criaGalao(cor) {
  const g = new THREE.Group();
  bloco(g, 170, 260, 130, mat(0xe9e6dc, 0.6), 0, 130, 0);
  bloco(g, 172, 90, 132, mat(cor, 0.55), 0, 170, 0, true);
  tubo(g, 26, 40, mat(cor, 0.5), "y", 44, 278, 0, 14);
  const al = new THREE.Mesh(new THREE.TorusGeometry(40, 8, 8, 16, Math.PI), mat(cor, 0.5)); al.position.set(-30, 258, 0); g.add(al);
  return g;
}

// ---------- lubrificador ----------
const L = { raiz: new THREE.Group(), j: {}, ang: { bd: 0, bdc: 0, be: 0, bec: 0, cx: 0, cn: 0, y: 0, cab: 0 } };
function lubrificador() {
  const uni = mat(0x2a4f7a, 0.8), refl = mat(0xd8dde0, 0.3, 0.3, { emissive: 0x777777 }), pele = mat(0xc99a78, 0.7);
  const bota = mat(0x1d1f22, 0.7), luva = mat(0x2d6ea8, 0.7), cap = mat(0xf0c419, 0.4, 0.1);
  const r = L.raiz, corpo = new THREE.Group();
  corpo.position.y = 880;
  r.add(corpo);
  L.j.corpo = corpo;
  const seg = (pai, r1, c, m, r2) => { const o = tubo(pai, r1, c, m, "y", 0, -c / 2, 0, 14, r2 ?? r1); return o; };
  const junta = (pai, x, y) => { const g = new THREE.Group(); g.position.set(x, y, 0); pai.add(g); return g; };
  [["pe", -105], ["pd", 105]].forEach(([n, x]) => {
    const cx = junta(corpo, x, 0); L.j[n] = cx;
    seg(cx, 72, 420, uni, 85);
    const j = junta(cx, 0, -420); L.j[n + "c"] = j;
    seg(j, 58, 400, uni, 70);
    bloco(j, 150, 22, 16, refl, 0, -170, 0, true); 
    bloco(j, 120, 70, 270, bota, 0, -425, 45);
  });
  bloco(corpo, 360, 560, 220, uni, 0, 290, 0);
  [130, 380].forEach((y) => { bloco(corpo, 366, 40, 226, refl, 0, y, 0, true); });
  placaTexto(corpo, ["LUBRIFICAÇÃO"], "#2a4f7a", "#fff", 260, 50, 0, 470, -112, Math.PI);
  tubo(corpo, 62, 70, pele, "y", 0, 605, 0, 14);
  const cab = junta(corpo, 0, 640); L.j.cab = cab;
  const cabeca = new THREE.Mesh(new THREE.SphereGeometry(105, 20, 16), pele); cabeca.position.y = 85; sombra(cabeca); cab.add(cabeca);
  const capacete = new THREE.Mesh(new THREE.SphereGeometry(120, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), cap); capacete.position.y = 105; sombra(capacete); cab.add(capacete);
  bloco(cab, 170, 14, 70, cap, 0, 112, 120, true);
  bloco(cab, 170, 40, 20, mat(0x1b2730, 0.2, 0.3), 0, 95, 102, true);
  [["be", -220], ["bd", 220]].forEach(([n, x]) => {
    const o = junta(corpo, x, 540); L.j[n] = o;
    seg(o, 56, 310, uni, 64);
    const c = junta(o, 0, -310); L.j[n + "c"] = c;
    seg(c, 44, 280, uni, 54);
    const m = new THREE.Mesh(new THREE.SphereGeometry(58, 12, 10), luva); m.position.y = -305; sombra(m); c.add(m);
    L.j[n + "m"] = m;
  });
  celular = new THREE.Group(); celular.position.set(0, -320, 55); celular.rotation.x = Math.PI / 2 - 0.4; L.j.bdc.add(celular);
  bloco(celular, 80, 12, 160, mat(0x15181b, 0.4, 0.3), 0, 0, 0, true);
  bloco(celular, 70, 2, 148, mat(0x9fe0a8, 0.4, 0, { emissive: 0x7fe08f, emissiveIntensity: 1 }), 0, 7, 0, true);
  cena.add(r);
}
let celular;
// ângulos de cada pose: braços (bd/be), antebraços (bdc/bec), coxa, canela, queda do corpo, cabeça
const POSES = {
  pe: { bd: -0.05, bdc: -0.1, be: 0.05, bec: -0.1, cx: 0, cn: 0, y: 0, cab: 0 },
  celular: { bd: -0.55, bdc: -1.0, be: 0.05, bec: -0.15, cx: 0, cn: 0, y: 0, cab: 0.45 },
  ler: { bd: -1.0, bdc: -0.45, be: 0.05, bec: -0.15, cx: 0, cn: 0, y: 0, cab: 0.55 },
  painel: { bd: -1.35, bdc: -0.25, be: 0.05, bec: -0.15, cx: 0, cn: 0, y: 0, cab: 0.1 },
  agachado: { bd: -0.8, bdc: -0.7, be: -0.7, bec: -0.8, cx: -1.3, cn: 1.7, y: -335, cab: 0.3 },
  despeja: { bd: -1.5, bdc: -0.35, be: -1.5, bec: -0.5, cx: 0, cn: 0, y: 0, cab: 0.5 }
};

// ---------- telas do celular (mesmos dados da ficha do RED-001) ----------
const cab = (t, s) => '<div class="cab">' + t + (s ? '<small>' + s + '</small>' : '') + '</div>';
const TELAS = {
  qr: '<div class="cam"><div class="mira"><img src="' + QR + '" alt="QR Code do redutor"></div><div>Lendo a etiqueta do RED-001…</div></div>',
  ficha: cab("RED-001 · Lubrificação", "Redutor WEG-Cestari 1:25") + '<div class="corpo">' +
    '<div class="c seg"><span class="rot">Segurança</span>Bloqueie (LOTO), luvas e óculos. Não misture óleos.</div>' +
    '<div class="c ama"><span class="rot" style="color:inherit">Vida útil do óleo</span><b>ATENÇÃO</b><br>Últimos 20 %: programar a troca</div>' +
    '<div class="c"><span class="rot">Óleo</span><b class="g">PAO ISO VG 460</b>Não misturar com mineral nem PG</div>' +
    '<div class="c"><span class="rot">Volume</span><b class="g">0,87 L</b></div>' +
    '<div class="c"><span class="rot">Pontos</span>Enche: respiro · Nível: bujão do meio · Dreno: bujão de baixo e da base</div></div>',
  loto: cab("Troca · passo 2", "Desligar e bloquear") + '<div class="corpo"><div class="c seg"><span class="rot">Antes de abrir</span>' +
    'Desligue no painel, tranque com cadeado e coloque a etiqueta "Não ligue".</div><div class="ok">✓ Equipamento bloqueado</div></div>',
  dreno: cab("Troca · drenar", "Bujão de baixo e bujão da base") + '<div class="corpo"><div class="c"><span class="rot">Observe o óleo retirado</span>' +
    'Cor, transparência e partículas.</div><div class="c"><span class="rot">Destino</span>Recipiente identificado, para o rerrefino.</div></div>',
  galao: '<div class="cam"><div class="gal"><div style="font-size:.8em">RED-001-OLE-04</div><div style="font-size:1.4em;margin:.2em 0">VG 460</div><div style="font-size:.8em">PAO · laranja</div></div>' +
    '<div class="ok" style="width:100%">✓ Galão certo para o RED-001</div></div>',
  enche: cab("Troca · abastecer", "Pelo respiro, na face de cima") + '<div class="corpo" style="align-items:center;justify-content:center;text-align:center">' +
    '<span class="rot">Volume indicado: 0,87 L</span><div class="lit"><span id="litros">0,00</span> L</div>' +
    '<div class="c" style="width:100%">Confira o nível pelo bujão do meio.</div></div>',
  registro: cab("Registro salvo") + '<div class="corpo"><div class="ok">✓ Troca · 0,87 L · PAO VG 460</div>' +
    '<div class="c"><span class="rot">Vida útil</span>Contagem reiniciada a partir de hoje</div>' +
    '<div class="c"><span class="rot">SAP PM (simulação)</span>Confirmação da ordem · Saída de material · Documento de medição</div></div>'
};

// ---------- passos ----------
const E = {};   // estado da cena
function estadoInicial() {
  Object.assign(E, { esteira: 1, lacre: false, balde: false, nivel: 0, drena: false, enche: false, litros: 0, galaoMao: false, funil: false, tampa: true });
}
const NA_FRENTE = [2000, 1020], NO_PAINEL = [3300, 1760], NO_DRENO = [2520, 560], NO_CARRINHO = [3300, 830];
const PASSOS = [
  { tit: "A fábrica", txt: "A casca de eucalipto vai pela esteira até a queima na caldeira. Quem aciona a esteira é o redutor RED-001. A máquina está rodando e a etiqueta de QR Code fica na face de cima do redutor.",
    cam: [[-7200, 4300, 7100], [900, 500, -900]], ini: [-8500, 1650], olha: 0, pose: "pe", dur: 5 },
  { tit: "Rota do lubrificador", txt: "O lubrificador segue pelo corredor com o celular. Não precisa ir até a sala de manutenção nem levar o manual.",
    rota: [[-3000, 1650], [1500, 1650], NA_FRENTE], olha: Math.PI, pose: "celular", seguir: [-2600, 1700, 4300], dur: 0.8 },
  { tit: "Lê o QR Code", txt: "Junto ao redutor, ele aponta a câmera para a etiqueta. Não precisa instalar aplicativo.",
    cam: [[3500, 1950, 1050], [2120, 1000, 760]], pose: "ler", tela: "qr", raio: true, dur: 4.5, beep: 3 },
  { tit: "A ficha abre na hora", txt: "Óleo, volume, pontos e segurança na mesma tela. A vida útil mostra que está na hora de programar a troca.",
    cam: [[3900, 2100, 2300], [2100, 1000, 800]], pose: "celular", tela: "ficha", dur: 6 },
  { tit: "Desliga e bloqueia (LOTO)", txt: "Para abrir o redutor, ele desliga no painel, tranca com cadeado e coloca a etiqueta. A esteira para. Sem isso, nada de abrir bujão.",
    rota: [[2800, 1500], NO_PAINEL], olha: 0, pose: "painel", cam: [[1300, 2000, 700], [3200, 1200, 1950]], tela: "loto", dur: 3.5,
    ao() { E.esteira = 0; E.lacre = true; } },
  { tit: "Drena o óleo usado", txt: "Com o redutor bloqueado, ele tira o bujão de dreno e observa cor, transparência e partículas do óleo que sai.",
    rota: [[2900, 1100], NO_DRENO], olha: -Math.PI / 2, pose: "agachado", cam: [[2450, 1300, 2900], [2420, 420, 560]], tela: "dreno", dur: 5,
    antes() { E.balde = true; }, ao() { E.drena = true; }, fim() { E.drena = false; E.nivel = 1; } },
  { tit: "Confere o galão", txt: "Ele lê o QR do galão. Se for o óleo errado, a ficha não deixa salvar. Aqui é o laranja, OLE-04 (código e cor de exemplo).",
    rota: [NO_CARRINHO], olha: Math.PI, pose: "ler", cam: [[5500, 1800, 1000], [3450, 800, 560]], tela: "galao", dur: 3.5, beep: 1.2 },
  { tit: "Abastece pelo respiro", txt: "Bujão de dreno fechado, ele enche pelo respiro até os 0,87 L, sem misturar óleos. O nível é conferido no bujão do meio.",
    rota: [[2700, 1200], NA_FRENTE], olha: Math.PI, pose: "despeja", cam: [[3600, 2000, 1350], [2130, 1100, 760]], tela: "enche", dur: 6,
    antes() { E.galaoMao = true; E.tampa = false; E.funil = true; }, ao() { E.enche = true; }, fim() { E.enche = false; E.litros = 0.87; E.galaoMao = false; E.funil = false; E.tampa = true; } },
  { tit: "Registra e libera", txt: "O registro é salvo em poucos toques, a contagem da vida útil recomeça e, na proposta, os documentos vão para o SAP. O bloqueio é retirado e a esteira volta.",
    cam: [[-3400, 2700, 6000], [800, 950, 600]], pose: "celular", tela: "registro", dur: 7,
    ao() { E.lacre = false; E.esteira = 1; E.balde = false; } }
];

// ---------- controle ----------
let atual = -1, tocando = true, rota = [], espera = 0, avancar = 0, chegou = false, seguir = null, camAlvo = null, heading = 0, poseAlvo = POSES.pe, passoT = 0, beepEm = -1;
const $ = (id) => document.getElementById(id);
const pontos = PASSOS.map(() => { const i = document.createElement("i"); $("pontos").appendChild(i); return i; });

function telaCel(nome) {
  const f = $("fone");
  if (!nome) { f.hidden = true; return; }
  $("tela").innerHTML = TELAS[nome];
  f.hidden = false;
}
function bipe() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 1500; g.gain.value = 0.06;
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.12);
  } catch (e) { /* som é opcional */ }
}
let audio = null;

// Vai para o passo n: refaz o estado dos passos anteriores e começa o passo n do início.
function ir(n, instantaneo) {
  n = Math.max(0, Math.min(PASSOS.length - 1, n));
  estadoInicial();
  let p = PASSOS[0].ini, h = 0;
  for (let i = 0; i < n; i++) {
    const s = PASSOS[i];
    if (s.antes) s.antes();
    if (s.ao) s.ao();
    if (s.fim) s.fim();
    if (s.rota) p = s.rota[s.rota.length - 1];
    if (s.olha != null) h = s.olha;
  }
  L.raiz.position.set(p[0], 0, p[1]);
  heading = h;
  const s = PASSOS[n];
  atual = n; rota = (s.rota || []).map((q) => q.slice()); chegou = false; passoT = 0; espera = 0; beepEm = -1;
  avancar = s.dur;
  seguir = s.seguir || null;
  poseAlvo = rota.length ? POSES.pe : POSES[s.pose];
  if (s.antes) s.antes();
  if (s.cam) camAlvo = { pos: new THREE.Vector3(...s.cam[0]), alvo: new THREE.Vector3(...s.cam[1]) };
  telaCel(s.rota ? null : s.tela);
  $("p-num").textContent = "Passo " + (n + 1) + " de " + PASSOS.length;
  $("p-tit").textContent = s.tit;
  $("p-txt").textContent = s.txt;
  pontos.forEach((d, i) => d.classList.toggle("on", i <= n));
  $("b-ant").disabled = n === 0;
  $("b-prox").disabled = n === PASSOS.length - 1;
  if (instantaneo) {
    if (rota.length) { const q = rota[rota.length - 1]; L.raiz.position.set(q[0], 0, q[1]); rota = []; }
    if (s.olha != null) heading = s.olha;
    if (s.cam) { camera.position.copy(camAlvo.pos); controles.target.copy(camAlvo.alvo); camAlvo = null; }
    Object.keys(POSES.pe).forEach((k) => { L.ang[k] = POSES[s.pose][k]; });
    chegada(s);
    if (s.tela === "enche") { E.litros = 0.6; mostrarLitros(); }
  }
}
function chegada(s) {
  chegou = true;
  poseAlvo = POSES[s.pose];
  if (s.tela) telaCel(s.tela);
  if (s.ao) s.ao();
  if (s.beep != null) beepEm = s.beep;
}
function mostrarLitros() { const el = $("litros"); if (el) el.textContent = E.litros.toFixed(2).replace(".", ","); }

function andar(dt) {
  const q = rota[0], r = L.raiz.position, dx = q[0] - r.x, dz = q[1] - r.z, d = Math.hypot(dx, dz), v = 1500;
  heading = Math.atan2(dx, dz);
  passoT += dt * 7.5;
  if (d <= v * dt) { r.x = q[0]; r.z = q[1]; rota.shift(); }
  else { r.x += dx / d * v * dt; r.z += dz / d * v * dt; }
}

function atualizar(dt, t) {
  const s = PASSOS[atual];
  if (rota.length) {
    andar(dt);
    if (!rota.length) chegada(s);
  } else if (!chegou) chegada(s);
  if (chegou && tocando) {
    avancar -= dt;
    if (avancar <= 0 && atual < PASSOS.length - 1) ir(atual + 1);
  }
  if (beepEm >= 0) { beepEm -= dt; if (beepEm < 0) { bipe(); } }

  // lubrificador
  const a = L.ang, j = L.j, k = 1 - Math.exp(-dt * 7);
  Object.keys(a).forEach((n) => { a[n] += (poseAlvo[n] - a[n]) * k; });
  const anda = rota.length ? Math.sin(passoT) : 0;
  L.raiz.rotation.y += (((heading - L.raiz.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
  j.corpo.position.y = 880 + a.y + (rota.length ? Math.abs(anda) * 18 : 0);
  j.pe.rotation.x = a.cx + anda * 0.55;
  j.pd.rotation.x = a.cx - anda * 0.55;
  j.pec.rotation.x = a.cn + (rota.length ? Math.max(0, -anda) * 0.7 : 0);
  j.pdc.rotation.x = a.cn + (rota.length ? Math.max(0, anda) * 0.7 : 0);
  j.bd.rotation.x = a.bd - (rota.length ? anda * 0.1 : 0);
  j.bdc.rotation.x = a.bdc;
  j.be.rotation.x = a.be - (rota.length ? anda * 0.45 : 0);
  j.bec.rotation.x = a.bec;
  j.cab.rotation.x = a.cab;
  celular.visible = s.pose !== "despeja";

  // esteira
  const alvo = E.esteira ? 1 : 0;
  velEsteira += (alvo - velEsteira) * (1 - Math.exp(-dt * 2.2));
  const dx = VEL_ESTEIRA * velEsteira * dt;
  correia.material[2].map.offset.x -= dx / 7000 * 26;
  tambores.forEach((d) => { d.rotation.z -= dx / R_TAMBOR; });
  cascaX.forEach((c, i) => {
    c.x += dx; if (c.x > 1800) c.x -= 6500;
    aux.position.set(c.x, c.y, c.z); aux.rotation.set(0, c.a, c.b); aux.updateMatrix();
    cascas.setMatrixAt(i, aux.matrix);
  });
  cascas.instanceMatrix.needsUpdate = true;
  fogo.material.emissiveIntensity = 1.5 + 0.5 * Math.sin(t * 9) * Math.sin(t * 3.3);

  // painel, bloqueio e óleo
  cadeado.visible = E.lacre;
  luzVerde.material.emissiveIntensity = E.lacre ? 0 : 1.4;
  luzVermelha.material.emissiveIntensity = E.lacre ? 1.6 : 0;
  balde.visible = E.balde || E.nivel > 0 && E.lacre;
  dreno.visible = !E.drena;
  respiro.visible = E.tampa;
  funil.visible = E.funil;
  jatoDreno.visible = E.drena && chegou;
  if (jatoDreno.visible) {
    const topo = POS_RED.y - 82, base = 40 + 240 * E.nivel;
    jatoDreno.scale.y = topo - base;
    jatoDreno.position.y = (topo + base) / 2;
    E.nivel = Math.min(1, E.nivel + dt / PASSOS[atual].dur);
  }
  nivelBalde.position.y = 30 + 240 * E.nivel;
  raio.visible = !!s.raio && chegou;
  if (raio.visible) {
    const de = celular.getWorldPosition(new THREE.Vector3()), para = new THREE.Vector3(POS_RED.x - 29, POS_RED.y + 92, POS_RED.z + 4);
    const v = para.clone().sub(de), c = v.length();
    raio.position.copy(de).addScaledVector(v, 0.5);
    raio.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    raio.scale.set(1, c, 1);
    raio.material.opacity = 0.25 + 0.15 * Math.sin(t * 8);
  }
  // galão: no carrinho, ou erguido sobre o funil quando abastece
  const naMao = E.galaoMao;
  if (naMao && galao.parent !== cena) cena.add(galao);
  if (!naMao && galao.parent === cena) { carrinho.add(galao); galao.position.set(0, 732, 0); galao.rotation.set(0, 0, 0); }
  if (naMao) {
    const m = j.bdm.getWorldPosition(new THREE.Vector3());
    if (chegou) { galao.position.set(POS_RED.x - 50, POS_RED.y + 215, POS_RED.z + 30); galao.rotation.z = -1.05; }
    else { galao.position.set(m.x, m.y - 270, m.z); galao.rotation.z = 0; }
  }
  jatoEnche.visible = E.enche;
  if (E.enche) {
    const topo = POS_RED.y + 245, base = POS_RED.y + 200;
    jatoEnche.position.set(funil.position.x, (topo + base) / 2, funil.position.z);
    jatoEnche.scale.y = topo - base;
    E.litros = Math.min(0.87, E.litros + 0.87 * dt / (PASSOS[atual].dur * 0.9));
    mostrarLitros();
  }
  if (s.tela === "enche" && !E.enche && E.litros) mostrarLitros();

  // câmera
  if (seguir && rota.length) {
    const r = L.raiz.position, foco = new THREE.Vector3(r.x, 1000, r.z), pos = new THREE.Vector3(r.x + seguir[0], seguir[1], r.z + seguir[2]);
    const c = 1 - Math.exp(-dt * 2.5);
    camera.position.lerp(pos, c); controles.target.lerp(foco, c);
    camAlvo = null;
  } else if (camAlvo) {
    const c = 1 - Math.exp(-dt * 1.8);
    camera.position.lerp(camAlvo.pos, c);
    controles.target.lerp(camAlvo.alvo, c);
    if (camera.position.distanceTo(camAlvo.pos) < 8) camAlvo = null;
  }
}
let velEsteira = 1, raio;
const aux = new THREE.Object3D();

// ---------- início ----------
function tamanho() {
  const w = caixaEl.clientWidth, h = caixaEl.clientHeight;
  render.setSize(w, h, false);
  render.domElement.style.width = w + "px";
  render.domElement.style.height = h + "px";
  camera.aspect = w / h;
  // tela em pé: abre um pouco mais o ângulo para o cenário caber
  camera.fov = w < h ? 56 : 38;
  camera.updateProjectionMatrix();
}
galpao();
caldeira();
esteira();
lubrificador();
raio = new THREE.Mesh(new THREE.CylinderGeometry(8, 34, 1, 18, 1, true), new THREE.MeshBasicMaterial({ color: 0x7fe08f, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false }));
raio.visible = false;
cena.add(raio);
window.addEventListener("resize", tamanho);
tamanho();

controles.addEventListener("start", () => { camAlvo = null; seguir = null; });
$("b-ant").onclick = () => ir(atual - 1);
$("b-prox").onclick = () => ir(atual + 1);
$("b-play").onclick = () => {
  tocando = !tocando;
  $("b-play").textContent = tocando ? "Pausar" : "Continuar";
  if (tocando && atual === PASSOS.length - 1 && avancar <= 0) ir(0);
};
$("b-tela").onclick = () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
};
// passador de slides e teclado
window.addEventListener("keydown", (ev) => {
  if (["ArrowRight", "PageDown"].includes(ev.key)) ir(atual + 1);
  else if (["ArrowLeft", "PageUp"].includes(ev.key)) ir(atual - 1);
  else if (ev.key === " ") { ev.preventDefault(); $("b-play").click(); }
});

// ?passo=3 abre direto nesse passo, parado (para prints e para a apresentação)
const pedido = new URLSearchParams(location.search).get("passo");
if (pedido) { tocando = false; $("b-play").textContent = "Continuar"; ir(Number(pedido) - 1, true); }
else {
  ir(0, true);
}

const relogio = new THREE.Clock();
function quadro() {
  requestAnimationFrame(quadro);
  if (document.hidden) { relogio.getDelta(); return; }
  const dt = Math.min(0.05, relogio.getDelta());
  atualizar(dt, relogio.elapsedTime);
  controles.update();
  render.render(cena, camera);
}
requestAnimationFrame(quadro);
