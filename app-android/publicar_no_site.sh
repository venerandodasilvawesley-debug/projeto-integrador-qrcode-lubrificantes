#!/usr/bin/env bash
# Publica o APK mais novo (release "app-android" do GitHub) no site, para a atualização automática:
# o app lê https://ficha-lubrificacao.vercel.app/app/versao.json e baixa /app/AlertaBomba.apk.
# Uso (na pasta do Projeto Integrador):  bash app-android/publicar_no_site.sh "o que mudou"
set -euo pipefail
cd "$(dirname "$0")/.."
SITE=prototipo_qrcode/site
NOTAS="${1:-Melhorias no alerta da bomba}"
# número da última compilação que deu certo = versionCode do APK
RUN=$(gh run list --workflow app-android.yml --status success --limit 1 --json number -q '.[0].number')
mkdir -p "$SITE/app"
gh release download app-android -p AlertaBomba.apk -D "$SITE/app" --clobber
python3 - "$SITE/app/versao.json" "$RUN" "$NOTAS" <<'PY'
import json, sys
caminho, run, notas = sys.argv[1], int(sys.argv[2]), sys.argv[3]
json.dump({"versionCode": run, "versionName": "1.0." + str(run), "url": "/app/AlertaBomba.apk", "notas": notas},
          open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY
cat "$SITE/app/versao.json"
(cd "$SITE" && vercel deploy --prod --yes >/dev/null)
curl -s https://ficha-lubrificacao.vercel.app/app/versao.json
