#!/usr/bin/env python3
"""Escreve no .odt os resultados da cronometragem (27/10/2026) e o ensaio de aprendizagem do óleo.

Troca o texto de parágrafos inteiros (achados por um trecho único), preenchendo as tabelas 1 a 3 e
mantendo os estilos do documento. Colchetes [..] viram destaque amarelo (T14); ^N^ vira citação
sobrescrita (TSUP). Depois: python3 gerar_docx_pdf.py
"""
import re
import shutil
import zipfile
from html import escape
from pathlib import Path

ODT = Path(__file__).with_name("Projeto_Integrador_QRCode_Lubrificantes.odt")
NB = " "

# ---------- dados da cronometragem (tempo total, em segundos) ----------
TRAD = [514.64, 643.84, 726.26, 654.55, 646.28]
QR = [213.21, 180.08, 141.18, 178.34, 177.94]
HORA = 14.32
INTERV = 12


def br(v, casas=1):
    return f"{v:,.{casas}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def mmss(s):
    s = round(s)
    return f"{s // 60}{NB}min {s % 60:02d}{NB}s"


mt, mq = sum(TRAD) / 5, sum(QR) / 5
ganho = mt - mq
red = ganho / mt * 100
ano_t, ano_q = mt * INTERV / 3600, mq * INTERV / 3600
ano_g = ano_t - ano_q
red_ind = [(t - q) / t * 100 for t, q in zip(TRAD, QR)]
R = {  # textos prontos
    "mt": br(mt), "mq": br(mq), "red": br(red), "ganho": br(ganho),
    "mt_m": mmss(mt), "mq_m": mmss(mq), "ganho_m": mmss(ganho),
    "ano_g": br(ano_g, 2), "rs_ano": br(ano_g * HORA, 2), "rs100": br(ano_g * HORA * 100, 0),
    "rmin": br(min(red_ind)), "rmax": br(max(red_ind)),
}


def rich(txt):
    """Texto com [destaque] e ^N^ (citação) → XML de parágrafo."""
    out = []
    for parte in re.split(r"(\[[^\]]*\]|\^\d+\^)", txt):
        if not parte:
            continue
        if parte.startswith("["):
            out.append(f'<text:span text:style-name="T14">{escape(parte, quote=False)}</text:span>')
        elif parte.startswith("^"):
            out.append(f'<text:span text:style-name="TSUP">{parte.strip("^")}</text:span>')
        else:
            out.append(escape(parte, quote=False))
    return "".join(out)


def plano(x):
    import html
    x = re.sub(r'<text:s text:c="(\d+)"/>', lambda m: " " * int(m.group(1)), x)
    x = x.replace("<text:s/>", " ").replace("<text:tab/>", "\t")
    return html.unescape(re.sub(r"<[^>]+>", "", x))


def estilo_de(s, trecho):
    """Tag de abertura do parágrafo que contém `trecho` (para copiar o estilo de um parágrafo normal)."""
    ms = [m for m in re.finditer(r"<text:p\b[^>]*>.*?</text:p>", s, flags=re.S) if trecho in plano(m.group(0))]
    return re.match(r"<text:p\b[^>]*>", ms[-1].group(0)).group(0)


def trocar_par(s, trecho, novo, no_corpo=True, abre=None):
    """Troca o conteúdo do parágrafo que contém `trecho` (no texto visível).
    abre: tag de abertura a usar (o parágrafo original pode ter estilo de destaque)."""
    achados = []
    for m in re.finditer(r"<text:p\b[^>]*>.*?</text:p>", s, flags=re.S):
        if trecho in plano(m.group(0)):
            achados.append(m)
    if no_corpo and len(achados) > 1:
        achados = achados[-1:]  # o primeiro costuma ser o sumário/listas
    assert len(achados) == 1, (trecho, len(achados))
    m = achados[0]
    abre = abre or re.match(r"<text:p\b[^>]*>", m.group(0)).group(0)
    return s[:m.start()] + abre + rich(novo) + "</text:p>" + s[m.end():]


def inserir_depois(s, trecho, novo):
    ms = [m for m in re.finditer(r"<text:p\b[^>]*>.*?</text:p>", s, flags=re.S) if trecho in plano(m.group(0))]
    m = ms[-1]
    abre = re.match(r"<text:p\b[^>]*>", m.group(0)).group(0)
    return s[:m.end()] + abre + rich(novo) + "</text:p>" + s[m.end():]


def tabela(s, marca, linhas):
    """Reescreve a tabela logo depois do bookmark `marca` com `linhas` (1ª = cabeçalho).
    Usa a 1ª linha do original como modelo do cabeçalho, a 2ª para o corpo e a última para a linha final."""
    k = s.index(f'<text:bookmark text:name="{marca}"/>')
    t0 = s.index("<table:table ", k)
    t1 = s.index("</table:table>", t0)
    x = s[t0:t1]
    rows = re.findall(r"<table:table-row\b.*?</table:table-row>", x, flags=re.S)
    cab, corpo, fim = rows[0], rows[1], rows[-1]

    def preenche(modelo, vals):
        cells = re.findall(r"<table:table-cell\b.*?</table:table-cell>", modelo, flags=re.S)
        assert len(cells) == len(vals), (len(cells), vals)
        novas = []
        for c, v in zip(cells, vals):
            c = re.sub(r"<text:p\b([^>]*?)/>", r"<text:p\1></text:p>", c)
            c = re.sub(r"(<text:p\b[^>]*>).*?(</text:p>)", lambda m: m.group(1) + rich(v) + m.group(2), c, count=1, flags=re.S)
            novas.append(c)
        abre = re.match(r"<table:table-row\b[^>]*>", modelo).group(0)
        return abre + "".join(novas) + "</table:table-row>"

    novo_cab = preenche(cab, linhas[0])
    corpo_rows = [preenche(fim if i == len(linhas) - 2 else corpo, l) for i, l in enumerate(linhas[1:])]
    # mantém tudo até o fim do cabeçalho; troca as linhas do corpo
    h_end = x.index("</table:table-header-rows>") + len("</table:table-header-rows>")
    inicio = x[:x.index(cab)] + novo_cab + x[x.index(cab) + len(cab):h_end]
    return s[:t0] + inicio + "".join(corpo_rows) + s[t1:]


def main():
    bak = ODT.with_name(ODT.stem + "_antes_editar_resultados.odt")
    if not bak.exists():
        shutil.copy2(ODT, bak)
    z = zipfile.ZipFile(ODT)
    s = z.read("content.xml").decode("utf-8")

    # ---------- títulos das tabelas (corpo e lista de tabelas) ----------
    for velho, novo in [("Tempos medidos no método tradicional", "Tempo total da tarefa por participante nos dois métodos"),
                        ("Tempos medidos no método com QR Code", "Resumo dos tempos por método"),
                        ("Comparação entre os métodos", "Ganho de tempo e custo evitado por ano, por redutor")]:
        assert s.count(velho) == 2, velho
        s = s.replace(velho, novo)

    # ---------- 1.2 escopo ----------
    s = trocar_par(s, "Não fazem parte do escopo a análise laboratorial do óleo",
        plano(re.search(r"<text:p\b[^>]*>(?:(?!</text:p>).)*Não fazem parte do escopo a análise laboratorial do óleo.*?</text:p>", s, flags=re.S).group(0))
        .replace("a análise laboratorial do óleo,", "a análise laboratorial do óleo do próprio redutor (feita apenas como ensaio de aprendizagem, com o óleo de outro equipamento, seção 2.2.2),"))

    # ---------- 2.2.2 ensaio de aprendizagem da análise do óleo ----------
    s = inserir_depois(s, "Como a equipe não teve acesso ao manual de peças do fabricante",
        "Para aprender o método de acompanhamento da condição do óleo, a equipe fez, no laboratório do SENAI Três Lagoas, "
        "um ensaio de viscosidade com um viscosímetro rotacional digital (Marte MVD-8): mediu o óleo novo e o óleo usado "
        f"drenado de um torno da oficina, ambos Ipiranga Ipitur HLP ISO{NB}VG{NB}68. Como as amostras estavam em temperaturas "
        f"diferentes (22,7{NB}°C e 27,3{NB}°C), os valores foram levados à mesma temperatura pela curva viscosidade × temperatura "
        "do óleo, calculada pela equação de Walther (ASTM D341) com os dados da ficha técnica do fabricante. O óleo usado "
        f"apresentou viscosidade cerca de 17{NB}% menor que a do óleo novo, além de aspecto esverdeado e turvo e depósito no fundo "
        "do béquer, indícios de contaminação. A partir desse ensaio, a ficha do redutor passou a mostrar, logo abaixo da vida "
        "útil do óleo, um cartão “Última análise do óleo” com semáforo, segundo critério adotado pelos autores e usual em "
        f"programas de análise de óleo: variação de viscosidade de até 10{NB}% em relação ao óleo novo, normal; de 10 a 20{NB}%, "
        f"atenção; acima de 20{NB}%, crítico. Enquanto o óleo do próprio redutor não é analisado – a amostra será coletada na "
        f"próxima troca, já que a carga é de apenas 0,87{NB}L –, o cartão exibe o ensaio de aprendizagem, identificado como tal, "
        "e permite registrar a primeira análise do redutor, cuja variação é calculada pela própria ficha.")

    # ---------- 2.2.3 cronometragem ----------
    s = trocar_par(s, "cinco participantes [descrever",
        "Para avaliar o ganho de tempo, foi realizada uma cronometragem em ambiente didático com cinco participantes, "
        "alunos do SENAI Três Lagoas [confirmar a turma], cada um executando a tarefa pelos dois métodos na oficina de "
        "mecânica, junto ao redutor. No método tradicional, o participante consultou a placa de identificação e o manual "
        "da linha coroa e rosca do fabricante, em PDF no celular, e registrou a intervenção em formulário de papel. No método "
        "com QR Code, escaneou a etiqueta impressa, afixada no próprio redutor, leu a ficha e registrou a intervenção no "
        "celular. Os tempos foram medidos com o cronômetro de um celular. O Quadro 3 apresenta as etapas da tarefa.")
    s = trocar_par(s, "Cada participante recebeu a mesma ordem de serviço",
        "Cada participante recebeu a mesma ordem de serviço, com o código do equipamento e a posição de trabalho. O cronômetro "
        "foi iniciado quando o participante recebeu a tarefa e parado quando o registro foi concluído (formulário em papel "
        "preenchido ou registro salvo no celular), de modo que o tempo medido reúne as etapas A, B e C do Quadro 3; as etapas "
        "não foram cronometradas separadamente. A aplicação do lubrificante em si não foi simulada, pois é igual nos dois métodos.")
    s = trocar_par(s, "foi adotada uma ordem contrabalanceada",
        "Como quem executa um método primeiro tende a memorizar as informações e a ganhar tempo no segundo, o planejamento "
        "previa uma ordem contrabalanceada; na execução, porém, os participantes começaram pelo método tradicional, o que pode "
        "ter favorecido o método com QR Code, feito em seguida, e é tratado como limitação na seção 2.3.2. A cronometragem não "
        "inclui o deslocamento até a sala de manutenção nem a consulta ao supervisor, que ocorrem no método tradicional em "
        "campo; por isso, os tempos tradicionais medidos tendem a ser menores que os reais.")

    # ---------- 2.3.1 dados ----------
    s = trocar_par(s, "As Tabelas 1 e 2 apresentam os tempos medidos",
        "A cronometragem foi realizada em outubro de 2026, na oficina de mecânica do SENAI Três Lagoas, junto ao redutor. "
        "A Tabela 1 apresenta o tempo total de cada participante nos dois métodos, a diferença e a redução percentual; "
        "a Tabela 2 resume os tempos de cada método.")
    linhas = [["Participante", "Tradicional (s)", "QR Code (s)", "Diferença (s)", "Redução (%)"]]
    for i, (t, q) in enumerate(zip(TRAD, QR), 1):
        linhas.append([str(i), br(t, 2), br(q, 2), br(t - q, 2), br((t - q) / t * 100)])
    linhas.append(["Média", br(mt, 2), br(mq, 2), br(ganho, 2), br(red)])
    s = tabela(s, "pag05", linhas)
    s = tabela(s, "pag06", [
        ["Método", "Média (s)", "Média (min:s)", "Menor (s)", "Maior (s)"],
        ["Tradicional", br(mt), f"{int(round(mt)) // 60}:{int(round(mt)) % 60:02d}", br(min(TRAD)), br(max(TRAD))],
        ["QR Code", br(mq), f"{int(round(mq)) // 60}:{int(round(mq)) % 60:02d}", br(min(QR)), br(max(QR))]])
    s = trocar_par(s, "A Tabela 3 compara as médias",
        f"A Tabela 3 aplica o tempo médio de cada método às {INTERV} intervenções anuais previstas e ao custo da hora do "
        "mecânico (seção 2.2.4).")
    s = tabela(s, "pag07", [
        ["Indicador", "Tradicional", "QR Code", "Ganho"],
        ["Tempo médio por intervenção", R["mt_m"], R["mq_m"], R["ganho_m"]],
        [f"Tempo em {INTERV} intervenções por ano", f"{br(ano_t, 2)}{NB}h", f"{br(ano_q, 2)}{NB}h", f"{R['ano_g']}{NB}h"],
        [f"Custo do tempo do mecânico por ano (R$ {br(HORA, 2)}/h)", f"R$ {br(ano_t * HORA, 2)}", f"R$ {br(ano_q * HORA, 2)}",
         f"R$ {R['rs_ano']}"],
        ["Redução do tempo", "–", "–", f"{R['red']}{NB}%"]])

    # ---------- 2.3.2 discussão ----------
    s = trocar_par(s, "[Interpretar os resultados", abre=estilo_de(s, "A redução do tempo gasto na identificação"), novo=
        f"Todos os participantes foram mais rápidos com o QR Code. O tempo médio caiu de {R['mt']}{NB}s ({R['mt_m']}) no método "
        f"tradicional para {R['mq']}{NB}s ({R['mq_m']}) com o QR Code, uma redução de {R['red']}{NB}%, ou cerca de {R['ganho_m']} "
        f"por intervenção. A redução individual variou de {R['rmin']}{NB}% a {R['rmax']}{NB}%, e os tempos ficaram mais próximos "
        f"entre si com o QR Code (de {br(min(QR), 0)} a {br(max(QR), 0)}{NB}s) do que no método tradicional (de {br(min(TRAD), 0)} "
        f"a {br(max(TRAD), 0)}{NB}s), o que indica que a ficha torna a tarefa mais padronizada e menos dependente de quem a executa. "
        "Como só o tempo total foi registrado, não é possível dizer em qual etapa houve a maior redução. Aplicado às "
        f"{INTERV} intervenções anuais, o ganho é de cerca de {R['ano_g']}{NB}h por ano e por redutor, que, ao custo de "
        f"R$ {br(HORA, 2)} por hora do mecânico, corresponde a aproximadamente R$ {R['rs_ano']} por ano (Tabela 3). O custo de "
        "implantação também é baixo: a página foi publicada em um serviço de hospedagem gratuito, e a etiqueta exige apenas "
        "impressão, plastificação e fita dupla-face [informar o custo da etiqueta]. Assim, o retorno de um único redutor é "
        f"pequeno em valor, mas positivo, e cresce com o número de equipamentos: para 100 equipamentos, o ganho estimado é de "
        f"cerca de R$ {R['rs100']} por ano, sem contar o custo da produção parada quando a busca de informações ocorre com o "
        "equipamento desligado.")
    s = trocar_par(s, "Como limitações do estudo, citam-se",
        plano(re.search(r"<text:p\b[^>]*>(?:(?!</text:p>).)*Como limitações do estudo, citam-se.*?</text:p>", s, flags=re.S).group(0))
        .replace("o efeito de aprendizado entre os métodos, que a ordem contrabalanceada reduz, mas não elimina;",
                 "o efeito de aprendizado entre os métodos, já que os participantes executaram primeiro o método tradicional; "
                 "o registro apenas do tempo total, sem a separação das etapas;"))

    # ---------- 3 conclusão ----------
    s = trocar_par(s, "[Responder ao problema de pesquisa",
        "O trabalho teve como objetivo reduzir o tempo do mecânico na identificação e no registro da lubrificação de um "
        "redutor de coroa e rosca sem fim WEG-Cestari, da linha Magma M, por meio de um QR Code fixado no equipamento. "
        "Os resultados respondem ao problema de pesquisa: com a ficha acessada pelo QR Code, o tempo médio para identificar "
        f"o lubrificante, localizar os pontos e registrar a intervenção caiu de {R['mt_m']} para {R['mq_m']}, uma redução de "
        f"{R['red']}{NB}%, e todos os cinco participantes foram mais rápidos com o QR Code. O objetivo foi, portanto, atingido.")
    s = trocar_par(s, "[Complementar com a avaliação do retorno",
        "A solução mostrou-se simples de implantar, por utilizar uma página web acessada pelo celular e uma etiqueta de baixo "
        "custo, e coerente com os princípios de Gestão Visual e de TPM. Em um único redutor, o ganho estimado é modesto – "
        f"cerca de {R['ano_g']}{NB}h e R$ {R['rs_ano']} por ano no tempo do mecânico –, mas o benefício cresce com o número de "
        "equipamentos atendidos. Além do tempo, a ficha padroniza o acesso às informações, reduz o risco de aplicar o óleo "
        "errado, gera um histórico de intervenções para o PCM e passou a mostrar a situação da última análise do óleo. Os "
        "resultados devem ser lidos considerando que a cronometragem foi feita em ambiente didático, com poucos "
        "participantes, que executaram primeiro o método tradicional.")
    s = s.replace("a inclusão da análise de óleo em laboratório, com coleta de amostra e reposição do volume retirado,",
                  "a análise do óleo do próprio redutor em laboratório, com a amostra coletada na troca, já prevista na ficha "
                  "a partir do ensaio de aprendizagem,")

    # ---------- resumo e abstract ----------
    s = trocar_par(s, "[Inserir os principais resultados e conclusões",
        plano(re.search(r"<text:p\b[^>]*>(?:(?!</text:p>).)*\[Inserir os principais resultados.*?</text:p>", s, flags=re.S).group(0))
        .replace("cinco participantes tiveram cronometradas as etapas de identificação do lubrificante, localização dos pontos e registro,",
                 "cinco participantes tiveram cronometrado o tempo total das etapas de identificação do lubrificante, localização dos pontos e registro,")
        .replace(", em ordem contrabalanceada.", ".")
        .replace("[Inserir os principais resultados e conclusões após a cronometragem.]",
                 f"O tempo médio caiu de {R['mt_m']} no método tradicional para {R['mq_m']} com o QR Code, redução de "
                 f"{R['red']}{NB}%, e todos os participantes foram mais rápidos com a ficha; o ganho estimado é de cerca de "
                 f"{R['ano_g']}{NB}h e R$ {R['rs_ano']} por ano por redutor, valor que cresce com o número de equipamentos atendidos."))
    s = trocar_par(s, "[Insert the main results and conclusions",
        plano(re.search(r"<text:p\b[^>]*>(?:(?!</text:p>).)*\[Insert the main results.*?</text:p>", s, flags=re.S).group(0))
        .replace("five participants were timed in the identification, point location and recording steps,",
                 "five participants had the total time of the identification, point location and recording steps measured,")
        .replace(", in counterbalanced order.", ".")
        .replace("[Insert the main results and conclusions after the time measurements.]",
                 f"The mean time fell from {mmss(mt)} with the traditional method to "
                 f"{mmss(mq)} with the QR Code, a {br(red).replace(',', '.')}{NB}% reduction, and all participants "
                 f"were faster with the data sheet; the estimated gain is about {R['ano_g'].replace(',', '.')}{NB}h and "
                 f"R$ {R['rs_ano'].replace(',', '.')} per year per reducer, a value that grows with the number of equipment items covered."))

    # ---------- etiqueta: posição real ----------
    s = trocar_par(s, "a etiqueta foi fixada na parte superior da face oposta ao motor",
        plano(re.search(r"<text:p\b[^>]*>(?:(?!</text:p>).)*a etiqueta foi fixada na parte superior da face oposta ao motor.*?</text:p>", s, flags=re.S).group(0))
        .replace("a etiqueta foi fixada na parte superior da face oposta ao motor (face da tampa cega), que é lisa e fica visível, "
                 "no mesmo ponto indicado no modelo tridimensional da ficha digital;",
                 "a etiqueta foi fixada na face superior, logo abaixo da etiqueta já existente no equipamento, região lisa e "
                 "visível para quem se aproxima do redutor;"))

    # ---------- grava ----------
    tmp = ODT.with_suffix(".tmp.odt")
    with zipfile.ZipFile(ODT) as zin, zipfile.ZipFile(tmp, "w") as zout:
        for it in zin.infolist():
            dados = s.encode("utf-8") if it.filename == "content.xml" else zin.read(it.filename)
            if it.filename == "mimetype":
                zout.writestr(it, dados, compress_type=zipfile.ZIP_STORED)
            else:
                zout.writestr(it, dados, compress_type=zipfile.ZIP_DEFLATED)
    tmp.replace(ODT)
    print("ok", {k: v for k, v in R.items()})


if __name__ == "__main__":
    main()
