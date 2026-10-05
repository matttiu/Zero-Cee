#!/usr/bin/env bash
# Checks the TLS certificate GitHub Pages serves for the custom domain.
#
# WHY IT CONNECTS TO GITHUB'S IPs DIRECTLY:
# With the Cloudflare proxy on, a normal "openssl s_client -connect www.zerocee.ch:443"
# shows CLOUDFLARE'S edge certificate, which auto-renews and is always fine. The
# certificate that expired on Oct 3 was the ORIGIN one (GitHub Pages / Let's Encrypt),
# which is only visible by connecting to GitHub's IPs with the right SNI. In SSL mode
# "Full" (non-strict) Cloudflare also won't complain about an expired origin cert, so
# without this check an origin expiry is completely silent.
#
# Exit code: 0 = all good, 1 = at least one problem (the workflow then opens an issue).
#
# Config via env vars (defaults are for zerocee.ch):
#   CERT_NAMES     hostnames to check               (default: "www.zerocee.ch zerocee.ch")
#   ORIGIN_IPS     GitHub Pages IPs to test         (default: the four 185.199.x.153 IPs)
#   PORT           TLS port                         (default: 443)
#   WARN_DAYS      fail if origin cert has < N days (default: 14)
#   EDGE_WARN_DAYS fail if edge cert has < N days   (default: 3)
#   REPORT_FILE    also write the report here       (default: none)

set -uo pipefail

read -r -a NAMES <<< "${CERT_NAMES:-www.zerocee.ch zerocee.ch}"
read -r -a IPS <<< "${ORIGIN_IPS:-185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153}"
PORT="${PORT:-443}"
WARN_DAYS="${WARN_DAYS:-14}"
EDGE_WARN_DAYS="${EDGE_WARN_DAYS:-3}"
REPORT_FILE="${REPORT_FILE:-/dev/null}"
: > "$REPORT_FILE"

FAILS=0
log()  { echo "$*" | tee -a "$REPORT_FILE"; }
fail() { log "  FAIL: $*"; FAILS=$((FAILS + 1)); }

# fetch_cert <connect-host> <sni-name>  -> PEM on stdout (empty on failure)
fetch_cert() {
  timeout 20 openssl s_client -connect "$1:$PORT" -servername "$2" </dev/null 2>/dev/null \
    | openssl x509 -outform PEM 2>/dev/null
}

# inspect_cert <label> <connect-host> <sni-name> <min-days>
inspect_cert() {
  local label="$1" host="$2" sni="$3" min_days="$4" pem end_raw end_epoch days issuer sans n
  log "- $label  (connect=$host, SNI=$sni)"
  pem="$(fetch_cert "$host" "$sni")"
  if [ -z "$pem" ]; then fail "could not fetch a certificate"; return; fi

  end_raw="$(openssl x509 -noout -enddate <<< "$pem" | cut -d= -f2)"
  end_epoch="$(date -d "$end_raw" +%s 2>/dev/null)"
  issuer="$(openssl x509 -noout -issuer <<< "$pem" | sed 's/^issuer=//')"
  sans="$(openssl x509 -noout -ext subjectAltName <<< "$pem" 2>/dev/null | tail -n +2 | tr -d ' \n')"
  if [ -z "$end_epoch" ]; then fail "could not parse expiry date '$end_raw'"; return; fi
  days=$(( (end_epoch - $(date +%s)) / 86400 ))

  log "    notAfter : $end_raw  (${days} days left)"
  log "    issuer   : $issuer"
  log "    SANs     : $sans"

  if ! openssl x509 -noout -checkend 0 <<< "$pem" >/dev/null; then
    fail "certificate is EXPIRED"
  elif [ "$days" -lt "$min_days" ]; then
    fail "only ${days} days left (threshold ${min_days})"
  fi

  # Only meaningful for the origin check: cert must cover both hostnames.
  if [ "$label" != "edge" ]; then
    for n in "${NAMES[@]}"; do
      case ",$sans," in *"DNS:$n,"*) ;; *) fail "SAN list is missing $n" ;; esac
    done
  fi
}

log "TLS certificate check, $(date -u '+%Y-%m-%d %H:%M UTC')"
log

log "== ORIGIN certificates (GitHub Pages, bypassing Cloudflare) =="
for name in "${NAMES[@]}"; do
  for ip in "${IPS[@]}"; do
    inspect_cert "origin" "$ip" "$name" "$WARN_DAYS"
  done
done
log

log "== EDGE certificates (what visitors get, via normal DNS) =="
for name in "${NAMES[@]}"; do
  inspect_cert "edge" "$name" "$name" "$EDGE_WARN_DAYS"
done
log

log "== HTTP status (no redirects followed; 3xx is fine, 000 or 5xx is not) =="
for name in "${NAMES[@]}"; do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$name/" 2>/dev/null || true)"
  log "- https://$name/ -> $code"
  case "$code" in
    000|5??) fail "https://$name/ returned $code" ;;
  esac
done
log

if [ "$FAILS" -gt 0 ]; then
  log "RESULT: $FAILS problem(s) found"
  exit 1
fi
log "RESULT: all checks passed"
