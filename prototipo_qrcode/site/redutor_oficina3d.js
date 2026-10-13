// Modelo 3D simplificado do redutor da oficina (WEG-Cestari coroa e rosca, eixo de saída vazado,
// flange para motor), usado na ficha de lubrificação para mostrar enchimento, nível e dreno.
// Desenhado por código a partir das fotos do redutor real (placa e adesivo são as próprias fotos), em medidas aproximadas: eixo de saída na direção Z,
// rosca sem fim na direção X (flange do motor em -X, tampa cega em +X), base para baixo.
// A posição dos bujões segue a marcação feita pela equipe no redutor.
import * as THREE from "./vendor/three.module.min.js";
import { criarVisualizador as criarBase, anel, noEixo, malha } from "./redutor3d.js";

export const PECAS = [
  { id: "carcaca", sigla: "CAR", nome: "Carcaça" },
  { id: "respiro", sigla: "RSP", nome: "Respiro (enchimento)" },
  { id: "nivel", sigla: "NIV", nome: "Bujões de nível" },
  { id: "dreno", sigla: "DRE", nome: "Bujões de dreno" },
  { id: "etiqueta", sigla: "QR", nome: "Etiqueta com QR Code" }
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
    if (s > 0) {
      p(noEixo(anel(51, 25, 9), "z"), M.azulEscuro, 0, 18, zf + 4.5);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 + Math.PI / 6, bx = Math.cos(a) * 42, by = 18 + Math.sin(a) * 42;
        p(cil(8, 1, "z"), M.usinado, bx, by, zf + 9.4);
        p(cil(6, 5.5, "z", 6), M.azulEscuro, bx, by, zf + 12.4);
      }
    } else {
      p(noEixo(anel(40, 25, 6), "z"), M.azulEscuro, 0, 18, zf - 3);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4, bx = Math.cos(a) * 46, by = 18 + Math.sin(a) * 46;
        p(cil(11, 6, "z"), M.azulEscuro, bx, by, zf - 3);
        p(cil(4, 0.8, "z"), M.furo, bx, by, zf - 6.2);
      }
    }
    const ze = zf + s * (s > 0 ? 9 : 6);
    p(noEixo(anel(29, 22, 1.2), "z"), M.usinado, 0, 18, ze + s * 0.4);  // alojamento usinado do retentor
    p(noEixo(anel(22, 17, 3), "z"), M.borracha, 0, 18, ze - s * 0.6);   // retentor
  });
  // eixo de saída vazado, com rasgo de chaveta
  p(noEixo(anel(17, 12, 134), "z"), M.aco, 0, 18, 1.5);
  p(caixa(6, 3.4, 134.6), M.furo, 0, 31.2, 1.5);

  // face da tampa cega da rosca sem fim (+X): frisos, ressalto em "Y" e tampa preta
  [4, 16, 28].forEach((y) => [-30, 30].forEach((z) => p(caixa(1.6, 6, 40), M.azulEscuro, 75.2, y, z)));
  p(noEixo(anel(31, 0, 5), "x"), M.azulEscuro, 76.5, -52, 0);
  [-0.62, 0.62].forEach((a) => { const o = p(caixa(4, 30, 13), M.azulEscuro, 75.5, -52 + Math.cos(a) * 38, Math.sin(a) * 38); o.rotation.x = a; });
  p(caixa(4, 16, 13), M.azulEscuro, 75.5, -84, 0);
  p(noEixo(anel(27, 21.5, 1.2), "x"), M.usinado, 79.4, -52, 0);
  p(noEixo(anel(21.5, 0, 2.4), "x"), M.borracha, 79.6, -52, 0);

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
  face(37, 17, 1.2, M.primer, -118.0);             // tampa central
  face(17, 12.5, 2.2, M.parafuso, -118.4);         // rolamento / retentor
  face(12.5, 8.5, 5, M.aco, -119.5);               // eixo de entrada vazado
  face(8.5, 0, 1, M.furo, -117.6);                 // fundo do furo
  for (let i = 0; i < 20; i++) {                   // estrias do eixo de entrada
    const a = i * Math.PI / 10;
    p(caixa(5, 1.1, 1.1), M.acoEscuro, -119.5, fy + Math.sin(a) * 8.6, Math.cos(a) * 8.6);
  }
  for (let i = 0; i < 4; i++) {
    // parafusos Allen da tampa central
    const b = i * Math.PI / 2 + 0.25;
    p(cil(4.2, 3, "x", 16), M.parafuso, -119.6, fy + Math.sin(b) * 27, Math.cos(b) * 27);
    p(cil(2.2, 0.6, "x", 6), M.furo, -121.2, fy + Math.sin(b) * 27, Math.cos(b) * 27);
    // prisioneiros com porca sextavada, para prender o motor
    const a = i * Math.PI / 2 + Math.PI / 4 + 0.12, y = fy + Math.sin(a) * 60, z = Math.cos(a) * 60;
    p(cil(4, 34, "x", 14), M.zinco, -120, y, z);
    p(cil(8, 6, "x", 6), M.zinco, -121.5, y, z);
    p(cil(4.1, 6, "x", 14), M.azulEscuro, -134.5, y, z); // ponta pintada
  }

  // face de cima: placa de identificação (foto da placa real, com os rebites) e adesivo "Retire o lacre"
  const deitado = (w, h) => new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2);
  p(caixa(43, 0.6, 22), M.zinco, 0, 89.2, -37);
  p(deitado(42, 20.5), M.placa, 0, 89.56, -37);
  [-17.5, 17.5].forEach((x) => p(cil(2.1, 1, "y"), M.zinco, x, 89.9, -36));
  p(deitado(34, 27.7), M.adesivo, 3, 89.12, 3);
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
  const frente = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, metalness: 0 });
  const face = new THREE.PlaneGeometry(38, 38);
  face.rotateY(Math.PI / 2); // voltada para +X
  g.add(malha(new THREE.BoxGeometry(0.8, 42, 42), M.zinco, -0.5, 0, 0));
  g.add(malha(face, frente, 0.05, 0, 0));
  return g;
}

function montar(M, qr) {
  const L = [];
  const add = (id, obj, pos, tag, local) => {
    obj.position.set(...pos);
    obj.userData = { peca: id, tag, local, base: new THREE.Vector3(...pos), desl: new THREE.Vector3(0, 0, 0) };
    L.push(obj);
  };
  add("carcaca", carcaca(M), [0, 0, 0], "CAR-01", "carcaça");
  add("respiro", respiro(M), [5, 89, 34], "RSP-01", "face de cima, junto ao adesivo \"Retire o lacre\"");
  add("nivel", bujao(M, "x", 9), [75, 68, 0], "NIV-01", "face da tampa cega, em cima");
  add("nivel", bujao(M, "x", 8), [75, -22, -34], "NIV-02", "face da tampa cega, no meio");
  add("dreno", bujao(M, "x", 6.5), [75, -82, 0], "DRE-01", "face da tampa cega, embaixo");
  add("dreno", bujao(M, "y", 8), [8, -89, 33], "DRE-02", "base do redutor");
  if (qr) add("etiqueta", etiqueta(M, qr), [76, 62, 33], "QR-01", "face da tampa cega, em cima");
  return L;
}

// opcoes.qr = endereço da imagem do QR Code da ficha; sem ela, o modelo fica sem a etiqueta
export function criarVisualizador(caixaEl, opcoes) {
  const qr = opcoes && opcoes.qr;
  return criarBase(caixaEl, opcoes, {
    pecas: qr ? PECAS : PECAS.filter((p) => p.id !== "etiqueta"),
    montar: (M) => montar(M, qr), materiais, casca: []
  });
}
