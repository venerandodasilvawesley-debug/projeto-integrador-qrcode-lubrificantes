# -*- coding: utf-8 -*-
"""
Protótipo paramétrico: berço para transportar motor elétrico em garfos de empilhadeira.

Uso (terminal Debian, sem GUI):
    freecadcmd suporte_motor_empilhadeira.py
Gera na pasta atual:
    suporte_motor_empilhadeira.FCStd  e  suporte_motor_empilhadeira.step

Eixos: X = comprimento dos garfos (X=0 é o lado do carro/encosto),
       Y = largura, Z = altura. Eixo do motor fica paralelo a X.
Todas as medidas em mm.
"""
import os
import math
import FreeCAD as App
import Part

V = App.Vector

# ----------------------- PARÂMETROS (edite aqui) -----------------------
MOTOR_D = 500        # diâmetro da carcaça do motor
MOTOR_L = 900        # comprimento da carcaça
MOTOR_KG = 800       # massa do motor

GARFO_LARG = 120     # largura do garfo
GARFO_ESP = 45       # espessura do garfo
GARFO_VAO = 600      # distância centro a centro entre garfos
FOLGA = 5            # folga de cada lado no bolso do garfo

PAREDE = 6           # parede dos tubos-bolso
PLACA_E = 12         # espessura da chapa base
MARGEM = 60          # sobra lateral da chapa além dos bolsos
SELA_E = 40          # espessura (ao longo de X) de cada sela em V
ENCOSTO_E = 15       # espessura do encosto traseiro
FOLGA_FRENTE = 100   # sobra da chapa além do motor (lado da ponta dos garfos)

ACO = 7.85e-6        # kg/mm3
# -----------------------------------------------------------------------

R = MOTOR_D / 2.0
bolso_l = GARFO_LARG + 2 * FOLGA
bolso_h = GARFO_ESP + 2 * FOLGA
tubo_l = bolso_l + 2 * PAREDE
tubo_h = bolso_h + 2 * PAREDE

motor_x0 = ENCOSTO_E + 20
base_l = motor_x0 + MOTOR_L + FOLGA_FRENTE
base_w = GARFO_VAO + tubo_l + 2 * MARGEM
z0 = tubo_h + PLACA_E            # topo da chapa base

parts = []

# 1) Bolsos dos garfos (tubos ocos) -----------------------------------
for s in (-1, 1):
    yc = s * GARFO_VAO / 2.0
    outer = Part.makeBox(base_l, tubo_l, tubo_h, V(0, yc - tubo_l / 2.0, 0))
    inner = Part.makeBox(base_l + 2, bolso_l, bolso_h,
                         V(-1, yc - bolso_l / 2.0, PAREDE))
    parts.append(outer.cut(inner))

# 2) Chapa base -------------------------------------------------------
parts.append(Part.makeBox(base_l, base_w, PLACA_E, V(0, -base_w / 2.0, tubo_h)))

# 3) Selas em V (90 graus) --------------------------------------------
w = 0.85 * R          # meia-largura do V no topo
d = w                 # profundidade (90 graus => d = w)
wb = w + 40           # meia-largura da base da sela
apex = 30             # altura do vértice do V acima da chapa
zc = z0 + apex + R * math.sqrt(2)   # altura do centro do motor


def sela(x):
    pts = [
        V(x, -wb, z0), V(x, wb, z0),
        V(x, wb, z0 + apex + d), V(x, w, z0 + apex + d),
        V(x, 0, z0 + apex),
        V(x, -w, z0 + apex + d), V(x, -wb, z0 + apex + d),
        V(x, -wb, z0),
    ]
    face = Part.Face(Part.makePolygon(pts))
    return face.extrude(V(SELA_E, 0, 0))


x_sela1 = motor_x0 + 0.12 * MOTOR_L
x_sela2 = motor_x0 + 0.75 * MOTOR_L
parts.append(sela(x_sela1))
parts.append(sela(x_sela2))

# 4) Encosto traseiro + 2 reforços (evita o motor deslizar ao inclinar) --
encosto_h = apex + R * math.sqrt(2)
parts.append(Part.makeBox(ENCOSTO_E, base_w, encosto_h, V(0, -base_w / 2.0, z0)))
for s in (-1, 1):
    yc = s * GARFO_VAO / 2.0
    pts = [V(ENCOSTO_E, yc - 5, z0), V(ENCOSTO_E + 90, yc - 5, z0),
           V(ENCOSTO_E, yc - 5, z0 + 130), V(ENCOSTO_E, yc - 5, z0)]
    parts.append(Part.Face(Part.makePolygon(pts)).extrude(V(0, 10, 0)))

# 5) Orelhas de amarração (cinta/catraca), 2 por lado --------------------
LUG_L, LUG_OUT, HOLE_D = 50, 40, 22
lug_pos = []
for x in (x_sela1, x_sela2):
    xc = x + SELA_E / 2.0
    for s in (-1, 1):
        y0 = s * base_w / 2.0 if s > 0 else -base_w / 2.0 - LUG_OUT
        parts.append(Part.makeBox(LUG_L, LUG_OUT, PLACA_E, V(xc - LUG_L / 2.0, y0, tubo_h)))
        lug_pos.append((xc, s * (base_w / 2.0 + LUG_OUT / 2.0)))

# União de tudo -----------------------------------------------------------
suporte = parts[0].multiFuse(parts[1:]).removeSplitter()
for (xc, yc) in lug_pos:
    suporte = suporte.cut(Part.makeCylinder(HOLE_D / 2.0, PLACA_E + 2, V(xc, yc, tubo_h - 1)))

# Motor de referência (só visualização) ---------------------------------------
motor = Part.makeCylinder(R, MOTOR_L, V(motor_x0, 0, zc), V(1, 0, 0))

# Verificações rápidas ------------------------------------------------------------
m_suporte = suporte.Volume * ACO
if len(suporte.Solids) == 1:
    suporte = suporte.Solids[0]
cg_s = V()
for so in suporte.Solids:
    cg_s += so.CenterOfMass * (so.Volume / suporte.Volume)
cg_x = (m_suporte * cg_s.x + MOTOR_KG * (motor_x0 + MOTOR_L / 2.0)) / (m_suporte + MOTOR_KG)
cg_z = (m_suporte * cg_s.z + MOTOR_KG * zc) / (m_suporte + MOTOR_KG)

print("=== Resumo do protótipo ===")
print("Chapa base: %.0f x %.0f mm" % (base_l, base_w))
print("Massa do suporte (aço): %.1f kg" % m_suporte)
print("Carga total na empilhadeira: %.1f kg" % (m_suporte + MOTOR_KG))
print("Centro de carga a partir do encosto: %.0f mm (ref. nominal de empilhadeira: 500 mm)" % cg_x)
print("Altura do CG acima do garfo: %.0f mm" % cg_z)
if cg_x > 500:
    print("ATENCAO: centro de carga acima de 500 mm -> capacidade da empilhadeira deve ser reduzida.")

# Exporta ---------------------------------------------------------------------------
OUT = os.getcwd()
doc = App.newDocument("SuporteMotor")
o1 = doc.addObject("Part::Feature", "Suporte")
o1.Shape = suporte
o2 = doc.addObject("Part::Feature", "Motor_referencia")
o2.Shape = motor
doc.recompute()
doc.saveAs(os.path.join(OUT, "suporte_motor_empilhadeira.FCStd"))
Part.export([o1, o2], os.path.join(OUT, "suporte_motor_empilhadeira.step"))
print("Arquivos salvos em:", OUT)

# Visualização (só quando rodado dentro do FreeCAD com interface) ----------------
if App.GuiUp:
    import FreeCADGui as Gui
    o2.ViewObject.Transparency = 70
    o2.ViewObject.ShapeColor = (0.2, 0.4, 0.8)
    Gui.activeDocument().activeView().viewIsometric()
    Gui.SendMsgToActiveView("ViewFit")
    doc.save()
