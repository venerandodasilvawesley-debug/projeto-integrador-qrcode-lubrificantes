#!/usr/bin/env python3
"""Gera o .docx e o .pdf a partir do .odt (que é o arquivo de trabalho).

Uso:  python3 gerar_docx_pdf.py            (feche o documento no LibreOffice antes)

No .docx, liga a atualização automática dos campos (o Word pergunta ao abrir se
pode atualizar: responda Sim) e desliga a hifenização, como no .odt.
"""
import shutil
import subprocess
import zipfile
from pathlib import Path

PASTA = Path(__file__).resolve().parent
ODT = PASTA / "Projeto_Integrador_QRCode_Lubrificantes.odt"


def converter(formato):
    subprocess.run(["soffice", "--headless", "--convert-to", formato, "--outdir", str(PASTA), str(ODT)],
                   check=True, capture_output=True, timeout=300)


def ajustar_docx(docx):
    tmp = docx.with_suffix(".tmp")
    with zipfile.ZipFile(docx) as z, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as novo:
        for item in z.infolist():
            dados = z.read(item.filename)
            if item.filename == "word/settings.xml":
                s = dados.decode("utf-8")
                s = s.replace('<w:autoHyphenation w:val="true"/>', '<w:autoHyphenation w:val="false"/>')
                if "<w:updateFields" not in s:
                    s = s.replace("<w:zoom ", '<w:updateFields w:val="true"/><w:zoom ', 1)
                dados = s.encode("utf-8")
            novo.writestr(item, dados)
    shutil.move(tmp, docx)


if __name__ == "__main__":
    converter("pdf")
    converter("docx:MS Word 2007 XML")
    ajustar_docx(ODT.with_suffix(".docx"))
    print("Gerados:", ODT.with_suffix(".docx").name, "e", ODT.with_suffix(".pdf").name)
