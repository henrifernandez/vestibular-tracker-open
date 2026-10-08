#!/usr/bin/env bash
# Teste de fumaça de uma instância no ar.
# Uso: scripts/smoke.sh producao https://seu-app.vercel.app
#      scripts/smoke.sh demo     https://sua-demo.vercel.app
set -u
modo="${1:-}"; base="${2:-}"
if [[ -z "$modo" || -z "$base" || ! "$modo" =~ ^(producao|demo)$ ]]; then
  echo "uso: $0 producao|demo <url-base>"; exit 2
fi
base="${base%/}"; falhas=0

codigo() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
confere() { # descricao esperado obtido
  if [[ "$2" == "$3" ]]; then echo "ok    $1 ($3)"; else echo "FALHA $1 (esperado $2, obtido $3)"; falhas=$((falhas+1)); fi
}

if [[ "$modo" == "producao" ]]; then
  confere "GET /api/simulados sem cookie" 401 "$(codigo "$base/api/simulados")"
  confere "GET /api/plano sem cookie" 401 "$(codigo "$base/api/plano")"
  confere "POST /api/simulados sem cookie" 401 "$(codigo -X POST -H 'Content-Type: application/json' -d '{}' "$base/api/simulados")"
  confere "DELETE /api/calendario sem cookie" 401 "$(codigo -X DELETE "$base/api/calendario?id=x")"
  confere "POST /api/redacao/avaliar sem cookie" 401 "$(codigo -X POST -H 'Content-Type: application/json' -d '{}' "$base/api/redacao/avaliar")"
  confere "GET /login" 200 "$(codigo "$base/login")"
  confere "login com senha errada" 401 "$(codigo -X POST -H 'Content-Type: application/json' -d '{"senha":"errada-smoke"}' "$base/api/login")"
else
  confere "GET /api/simulados" 200 "$(codigo "$base/api/simulados")"
  confere "GET /api/plano" 200 "$(codigo "$base/api/plano")"
  confere "GET /api/calendario" 200 "$(codigo "$base/api/calendario")"
  confere "POST /api/simulados" 403 "$(codigo -X POST -H 'Content-Type: application/json' -d '{}' "$base/api/simulados")"
  confere "POST /api/redacao/avaliar" 403 "$(codigo -X POST -H 'Content-Type: application/json' -d '{}' "$base/api/redacao/avaliar")"
  confere "DELETE /api/simulados/x" 403 "$(codigo -X DELETE "$base/api/simulados/x")"
fi

cors=$(curl -s -D - -o /dev/null --max-time 20 -H 'Origin: https://site-aleatorio.example' "$base/api/simulados" | tr -d '\r' | grep -i '^access-control-allow-origin:' || true)
if [[ -z "$cors" ]]; then echo "ok    sem Access-Control-Allow-Origin"; else echo "FALHA CORS aberto: $cors"; falhas=$((falhas+1)); fi

echo; [[ $falhas -eq 0 ]] && echo "Tudo certo." || echo "$falhas falha(s)."
exit $((falhas>0))
