// Modelo 3D simplificado do redutor da oficina (WEG-Cestari coroa e rosca, eixo de saída vazado,
// flange para motor), usado na ficha de lubrificação para mostrar enchimento, nível e dreno.
// Desenhado por código a partir das fotos, em medidas aproximadas: eixo de saída na direção Z,
// rosca sem fim na direção X (flange do motor em -X, tampa cega em +X), base para baixo.
// A posição dos bujões segue a marcação feita pela equipe no redutor.
import * as THREE from "./vendor/three.module.min.js";
import { criarVisualizador as criarBase, anel, noEixo, malha } from "./redutor3d.js";

export const PECAS = [
  { id: "carcaca", sigla: "CAR", nome: "Carcaça" },
  { id: "respiro", sigla: "RSP", nome: "Respiro (enchimento)" },
  { id: "nivel", sigla: "NIV", nome: "Bujões de nível" },
  { id: "dreno", sigla: "DRE", nome: "Bujões de dreno" }
];

function materiais() {
  const m = (o) => new THREE.MeshStandardMaterial(o);
  return {
    azul: m({ color: 0x1f7fc4, roughness: 0.55, metalness: 0.1 }),
    azulEscuro: m({ color: 0x17649c, roughness: 0.6, metalness: 0.1 }),
    latao: m({ color: 0xc9a23a, roughness: 0.35, metalness: 0.75 }),
    placa: m({ color: 0xc62828, roughness: 0.6, metalness: 0.1 }),
    adesivo: m({ color: 0xf2d21b, roughness: 0.7, metalness: 0 }),
    zinco: m({ color: 0xd5dade, roughness: 0.4, metalness: 0.6 })
  };
}

const caixa = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function carcaca(M) {
  const g = new THREE.Group();
  g.add(malha(caixa(150, 178, 110), M.azul, 0, 0, 0));
  // sapatas de fixação, em cima e embaixo, com os furos roscados
  [[-58, 1], [58, 1], [-58, -1], [58, -1]].forEach(([x, s]) => {
    g.add(malha(caixa(34, 8, 110), M.azulEscuro, x, s * 93, 0));
    [-33, 33].forEach((z) => {
      if (s > 0) g.add(malha(new THREE.CylinderGeometry(8, 8, 5, 20), M.zinco, x, 99.5, z)); // tampões plásticos
      else g.add(malha(new THREE.CylinderGeometry(5, 5, 1, 16), M.furo, x, -97.2, z));
    });
  });
  // aletas da face da tampa cega
  [8, 22, 36].forEach((y) => [-30, 30].forEach((z) => g.add(malha(caixa(3, 6, 42), M.azulEscuro, 75.5, y, z))));
  // tampas do eixo de saída (frente e trás), com parafusos
  [1, -1].forEach((s) => {
    g.add(malha(noEixo(anel(50, 22, 10), "z"), M.azulEscuro, 0, 18, s * 59));
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      g.add(malha(noEixo(new THREE.CylinderGeometry(5.5, 5.5, 5, 6), "z"), M.parafuso, Math.cos(a) * 41, 18 + Math.sin(a) * 41, s * 66));
    }
    g.add(malha(noEixo(anel(22, 16.5, 4), "z"), M.borracha, 0, 18, s * 63)); // retentor
  });
  // eixo de saída vazado, com rasgo de chaveta
  g.add(malha(noEixo(anel(16.5, 11, 136), "z"), M.aco, 0, 18, 0));
  g.add(malha(caixa(5, 4, 137), M.furo, 0, 28.5, 0));
  // tampa cega da rosca sem fim (lado oposto ao motor)
  g.add(malha(noEixo(anel(27, 0, 8), "x"), M.azulEscuro, 77, -52, 0));
  g.add(malha(noEixo(anel(21, 0, 3), "x"), M.borracha, 81, -52, 0));
  // pescoço e flange do motor
  g.add(malha(noEixo(new THREE.CylinderGeometry(30, 40, 34, 32), "x"), M.azul, -92, -52, 0));
  g.add(malha(noEixo(anel(72, 20, 9), "x"), M.azul, -113, -52, 0));
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    g.add(malha(noEixo(new THREE.CylinderGeometry(4, 4, 30, 12), "x"), M.zinco, -118, -52 + Math.sin(a) * 60, Math.cos(a) * 60));
  }
  // placa de identificação e adesivo "Retire o lacre"
  g.add(malha(caixa(52, 1, 28), M.placa, 8, 89.5, -30));
  g.add(malha(caixa(34, 0.8, 26), M.adesivo, 8, 89.4, 6));
  return g;
}

// respiro de latão: sextavado com válvula em cima
function respiro(M) {
  const g = new THREE.Group();
  g.add(malha(new THREE.CylinderGeometry(9, 9, 6, 6), M.latao, 0, 3, 0));
  g.add(malha(new THREE.CylinderGeometry(6.5, 6.5, 9, 20), M.latao, 0, 10, 0));
  g.add(malha(new THREE.CylinderGeometry(4.5, 4.5, 4, 16), M.latao, 0, 16, 0));
  return g;
}

// bujão sextavado, com a cabeça apontando para +eixo
function bujao(M, eixo, r) {
  const g = new THREE.Group();
  const cabeca = noEixo(new THREE.CylinderGeometry(r, r, 6, 6), eixo);
  const base = noEixo(new THREE.CylinderGeometry(r + 2.5, r + 2.5, 2, 24), eixo);
  if (eixo === "x") { cabeca.translate(4, 0, 0); base.translate(1, 0, 0); } else { cabeca.translate(0, -4, 0); base.translate(0, -1, 0); }
  g.add(malha(cabeca, M.zinco)); g.add(malha(base, M.acoEscuro));
  return g;
}

function montar(M) {
  const L = [];
  const add = (id, obj, pos, tag, local) => {
    obj.position.set(...pos);
    obj.userData = { peca: id, tag, local, base: new THREE.Vector3(...pos), desl: new THREE.Vector3(0, 0, 0) };
    L.push(obj);
  };
  add("carcaca", carcaca(M), [0, 0, 0], "CAR-01", "carcaça");
  add("respiro", respiro(M), [6, 89, 40], "RSP-01", "face de cima, junto ao adesivo \"Retire o lacre\"");
  add("nivel", bujao(M, "x", 9), [75, 68, 0], "NIV-01", "face da tampa cega, em cima");
  add("nivel", bujao(M, "x", 8), [75, -22, -34], "NIV-02", "face da tampa cega, no meio");
  add("dreno", bujao(M, "x", 6.5), [75, -82, 0], "DRE-01", "face da tampa cega, embaixo");
  add("dreno", bujao(M, "y", 8), [8, -89, 33], "DRE-02", "base do redutor");
  return L;
}

const MODELO = { pecas: PECAS, montar, materiais, casca: [] };

export function criarVisualizador(caixaEl, opcoes) {
  return criarBase(caixaEl, opcoes, MODELO);
}
