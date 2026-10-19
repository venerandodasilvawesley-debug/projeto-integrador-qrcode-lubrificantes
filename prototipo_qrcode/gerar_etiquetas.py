#!/usr/bin/env python3
"""Gera as páginas de etiqueta (QR Code) de cada equipamento e dos galões de óleo em site/.

Precisa do programa `qrencode` (sudo apt install qrencode).

Uso:
    python3 gerar_etiquetas.py https://endereco-do-site            # QR de 3 cm
    python3 gerar_etiquetas.py https://endereco-do-site --lado 4

Depois de gerar, publique de novo:  cd site && vercel deploy --prod
"""
import argparse
import html
import json
import re
import subprocess
from pathlib import Path

SITE = Path(__file__).resolve().parent / "site"

MODELO = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Etiqueta {codigo}</title>
<style>
body{{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#000;background:#fff}}
.instrucoes{{max-width:560px;margin:14px;font-size:.95rem}}
.etiqueta{{display:inline-block;vertical-align:top;border:.06cm solid #627c42;
  border-radius:.2cm;overflow:hidden;margin:.5cm;page-break-inside:avoid}}
/* faixa verde com as ondas (identidade visual); sai na impressão com as cores */
.faixa{{background:#627c42 url(/ondas.svg) center/cover no-repeat;color:#fff;font-weight:800;font-size:10pt;
  letter-spacing:.3px;padding:.12cm .25cm;text-shadow:0 1px 2px rgba(0,0,0,.6);
  -webkit-print-color-adjust:exact;print-color-adjust:exact}}
.corpo{{display:flex;gap:.3cm;align-items:center;padding:.25cm}}
.etiqueta svg{{display:block;width:{lado}cm;height:{lado}cm}}
.txt{{max-width:4.2cm;font-size:9pt;line-height:1.25}}
.cod{{font-size:17pt;font-weight:800;line-height:1.1}}
/* cor do galão: feita com borda, que sai na impressão mesmo sem "imprimir cores de fundo" */
.oleo{{display:flex;align-items:center;gap:.15cm;margin-top:.12cm;font-size:8pt;line-height:1.2}}
.oleo i{{flex:none;width:0;height:0;border:.3cm solid #000;border-radius:.08cm;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}}
@media print{{.instrucoes{{display:none}}}}
</style>
</head>
<body>
<div class="instrucoes">
<p><b>Etiqueta de {codigo}</b> – QR Code de {lado} cm de lado, correção de erros nível H.</p>
<p>Endereço codificado: {url}</p>
<p>Imprima em escala 100% (sem "ajustar à página"). <a href="/e/{codigo}">Voltar à ficha</a></p>
</div>
{etiqueta}{etiqueta}
</body>
</html>
"""

ETIQUETA = """<div class="etiqueta"><div class="faixa">{titulo}</div><div class="corpo">{svg}
<div class="txt"><div class="cod">{codigo}</div>
{nome}<br>Aponte a câmera do celular para o código.{oleo}</div></div></div>
"""


def qr_svg(url):
    """SVG do QR Code com correção de erros nível H (cerca de 30%)."""
    saida = subprocess.run(
        ["qrencode", "-t", "SVG", "-l", "H", "-m", "4", "-o", "-", url],
        capture_output=True, text=True, check=True,
    ).stdout
    svg = saida[saida.index("<svg"):]
    # tira o tamanho fixo para o CSS da etiqueta controlar a dimensão
    return re.sub(r'(<svg[^>]*?)\swidth="[^"]*"\sheight="[^"]*"', r"\1", svg, count=1)


def faixa_oleo(codigo, e):
    """Cor do galão e tag do óleo, para o mecânico pedir no almoxarifado."""
    cor = e.get("cor_oleo")
    if not cor:
        return ""
    tag = f"<br>{html.escape(codigo + '-' + e['tag_oleo'])}" if e.get("tag_oleo") else ""
    return (f'<div class="oleo"><i style="border-color:{html.escape(cor["hex"])}"></i>'
            f'<span>Óleo: galão <b>{html.escape(cor["nome"].upper())}</b>{tag}</span></div>')


GALOES = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Etiquetas dos galões de óleo</title>
<style>
body{{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#000;background:#fff}}
.instrucoes{{max-width:560px;margin:14px;font-size:.95rem}}
.etiqueta{{display:inline-block;vertical-align:top;border:.25cm solid #000;
  border-radius:.25cm;overflow:hidden;margin:.5cm;page-break-inside:avoid;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}}
/* faixa verde com as ondas (identidade visual); sai na impressão com as cores */
.faixa{{background:#627c42 url(/ondas.svg) center/cover no-repeat;color:#fff;font-weight:800;font-size:10pt;
  letter-spacing:.3px;padding:.12cm .25cm;text-shadow:0 1px 2px rgba(0,0,0,.6);
  -webkit-print-color-adjust:exact;print-color-adjust:exact}}
.corpo{{display:flex;gap:.3cm;align-items:center;padding:.25cm}}
.etiqueta svg{{display:block;width:{lado}cm;height:{lado}cm}}
.txt{{max-width:4.6cm;font-size:9pt;line-height:1.25}}
.cod{{font-size:17pt;font-weight:800;line-height:1.1}}
@media print{{.instrucoes{{display:none}}}}
</style>
</head>
<body>
<div class="instrucoes">
<p><b>Etiquetas dos galões de óleo</b> – cole no galão. A borda tem a cor do galão.</p>
<p>Na ficha do equipamento, o botão <b>Conferir o galão</b> lê este QR Code e diz se é o óleo certo.
OLE-02 e OLE-03 são óleos de exemplo, para demonstrar o aviso de óleo errado.</p>
<p>Imprima em escala 100% (sem "ajustar à página"). <a href="/">Início</a></p>
</div>
{etiquetas}
</body>
</html>
"""

GALAO = """<div class="etiqueta" style="border-color:{hex}"><div class="faixa">GALÃO {cor}</div><div class="corpo">{svg}
<div class="txt"><div class="cod">{codigo}</div>
{nome}<br>{base} · {visc}</div></div></div>
"""


def etiquetas_galoes(base, lado):
    """Uma etiqueta por óleo de oleos.json; o QR leva a /g/OLE-01."""
    arq = SITE / "oleos.json"
    if not arq.exists():
        return
    oleos = json.loads(arq.read_text(encoding="utf-8"))
    partes = []
    for codigo, o in oleos.items():
        url = f"{base}/g/{codigo}"
        partes.append(GALAO.format(svg=qr_svg(url), codigo=html.escape(codigo), hex=html.escape(o["cor"]["hex"]),
                                   cor=html.escape(o["cor"]["nome"].upper()), nome=html.escape(o["nome"]),
                                   base=html.escape(o["base"]), visc=html.escape(o["viscosidade"])))
        print(f"galão {codigo}: {url}")
    destino = SITE / "etiqueta-galoes.html"
    destino.write_text(GALOES.format(lado=html.escape(lado), etiquetas="".join(partes)), encoding="utf-8")
    print(destino.name)


def main():
    ap = argparse.ArgumentParser(description="Gera as etiquetas com QR Code")
    ap.add_argument("url_base", help="endereço do site publicado, ex.: https://exemplo.vercel.app")
    ap.add_argument("--lado", default="3", help="lado do QR Code em cm (padrão: 3)")
    args = ap.parse_args()
    base = args.url_base.rstrip("/")

    equipamentos = json.loads((SITE / "equipamentos.json").read_text(encoding="utf-8"))
    for codigo, e in equipamentos.items():
        # com lubrificação e inspeção, cada trabalho tem o seu QR Code: /l/ e /i/
        # a ficha de lubrificação pode ter dados próprios (bloco "lubrificacao"), diferentes dos da inspeção
        lub = {**e, **e.get("lubrificacao", {})}
        if e.get("inspecao"):
            partes = [("LUBRIFICAÇÃO", f"{base}/l/{codigo}", faixa_oleo(codigo, lub), lub["nome"]),
                      ("INSPEÇÃO E POP", f"{base}/i/{codigo}", "", e["nome"])]
        else:
            partes = [("MONITORAMENTO" if e.get("tipo") == "monitoramento" else "LUBRIFICAÇÃO",
                       f"{base}/e/{codigo}", faixa_oleo(codigo, lub), lub["nome"])]
        etiqueta = "".join(ETIQUETA.format(svg=qr_svg(url), codigo=html.escape(codigo), titulo=titulo,
                                           nome=html.escape(nome), oleo=oleo) for titulo, url, oleo, nome in partes)
        urls = " · ".join(f"<code>{html.escape(p[1])}</code>" for p in partes)
        destino = SITE / f"etiqueta-{codigo}.html"
        destino.write_text(MODELO.format(codigo=html.escape(codigo), lado=html.escape(args.lado),
                                         url=urls, etiqueta=etiqueta), encoding="utf-8")
        print(f"{destino.name}: " + " | ".join(p[1] for p in partes))
        # o mesmo QR Code da lubrificação, em imagem, para aparecer colado no modelo 3D da ficha
        img = lub.get("pontos_oleo", {}).get("qr")
        if img:
            subprocess.run(["qrencode", "-t", "PNG", "-l", "H", "-m", "2", "-s", "12", "-o", str(SITE / img.lstrip("/")), partes[0][1]], check=True)
            print(f"{img}: {partes[0][1]}")
    etiquetas_galoes(base, args.lado)


if __name__ == "__main__":
    main()
