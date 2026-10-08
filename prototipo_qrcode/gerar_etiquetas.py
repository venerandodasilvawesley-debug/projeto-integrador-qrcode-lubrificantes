#!/usr/bin/env python3
"""Gera as páginas de etiqueta (QR Code) de cada equipamento em site/.

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
.etiqueta{{display:inline-flex;gap:.3cm;align-items:center;border:1px solid #000;
  border-radius:.2cm;padding:.25cm;margin:.5cm;page-break-inside:avoid}}
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
<p>Endereço codificado: <code>{url}</code></p>
<p>Imprima em escala 100% (sem "ajustar à página"). <a href="/e/{codigo}">Voltar à ficha</a></p>
</div>
{etiqueta}{etiqueta}
</body>
</html>
"""

ETIQUETA = """<div class="etiqueta">{svg}
<div class="txt"><div class="cod">{codigo}</div>
<b>LUBRIFICAÇÃO E INSPEÇÃO</b><br>{nome}<br>Aponte a câmera do celular para o código.{oleo}</div></div>
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


def main():
    ap = argparse.ArgumentParser(description="Gera as etiquetas com QR Code")
    ap.add_argument("url_base", help="endereço do site publicado, ex.: https://exemplo.vercel.app")
    ap.add_argument("--lado", default="3", help="lado do QR Code em cm (padrão: 3)")
    args = ap.parse_args()
    base = args.url_base.rstrip("/")

    equipamentos = json.loads((SITE / "equipamentos.json").read_text(encoding="utf-8"))
    for codigo, e in equipamentos.items():
        url = f"{base}/e/{codigo}"
        etiqueta = ETIQUETA.format(svg=qr_svg(url), codigo=html.escape(codigo),
                                   nome=html.escape(e["nome"]), oleo=faixa_oleo(codigo, e))
        destino = SITE / f"etiqueta-{codigo}.html"
        destino.write_text(MODELO.format(codigo=html.escape(codigo), lado=html.escape(args.lado),
                                         url=html.escape(url), etiqueta=etiqueta), encoding="utf-8")
        print(f"{destino.name}: {url}")


if __name__ == "__main__":
    main()
