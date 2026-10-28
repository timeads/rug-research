#!/usr/bin/env bash
# Sets up the public site's address on Cloudflare (safe to run again: it only adds what is missing).
#   1. attaches www.historyoftuftedrugs.com and historyoftuftedrugs.com to the Pages project;
#   2. points both names at the project in DNS (only where no record exists yet);
#   3. redirects historyoftuftedrugs.com to www.historyoftuftedrugs.com (301, keeping the path).
# Needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID; called by .github/workflows/deploy-cloudflare.yml.
set -euo pipefail

PROJECT="${PROJECT:?}"
APEX="historyoftuftedrugs.com"
WWW="www.$APEX"
API="https://api.cloudflare.com/client/v4"
cf() { curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" "$@"; }
ok() { jq -e '.success' >/dev/null <<<"$1"; }
errors() { jq -r '[.errors[]?.message] | join("; ")' <<<"$1"; }

# The project's own address (Cloudflare may add a suffix if the name was taken).
project=$(cf "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT")
ok "$project" || { echo "Could not read the Pages project: $(errors "$project")"; exit 1; }
target=$(jq -r '.result.subdomain' <<<"$project")
echo "Project $PROJECT is at $target"

# 1. Custom domains on the project.
for name in "$WWW" "$APEX"; do
  r=$(cf -X POST "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains" -d "{\"name\":\"$name\"}")
  if ok "$r"; then echo "Added $name to the project"; else echo "$name: $(errors "$r")"; fi
done

# 2. DNS: a proxied CNAME for each name, unless the name already has a record (never overwritten).
zone=$(cf "$API/zones?name=$APEX" | jq -r '.result[0].id // empty')
[ -n "$zone" ] || { echo "The zone $APEX is not in this account (or the token cannot read it)."; exit 1; }
for name in "$WWW" "$APEX"; do
  existing=$(cf "$API/zones/$zone/dns_records?name=$name" | jq -r '[.result[]? | "\(.type) \(.content)"] | join(", ")')
  if [ -n "$existing" ]; then echo "DNS for $name already set: $existing"; continue; fi
  r=$(cf -X POST "$API/zones/$zone/dns_records" -d "{\"type\":\"CNAME\",\"name\":\"$name\",\"content\":\"$target\",\"proxied\":true,\"comment\":\"A History of Tufted Rugs (Cloudflare Pages)\"}")
  if ok "$r"; then echo "DNS: $name -> $target"; else echo "DNS for $name failed: $(errors "$r")"; exit 1; fi
done

# 3. Redirect the bare domain to www, added to the zone's redirect rules unless already there.
phase="$API/zones/$zone/rulesets/phases/http_request_dynamic_redirect/entrypoint"
current=$(cf "$phase")
rules=$(jq -c '.result.rules // []' <<<"$current" 2>/dev/null || echo '[]')
if jq -e 'any(.[]; .description == "historyoftuftedrugs.com to www")' >/dev/null <<<"$rules"; then
  echo "Redirect to www already in place"
else
  rule=$(jq -nc --arg apex "$APEX" --arg www "$WWW" '{
    description: "historyoftuftedrugs.com to www", enabled: true, action: "redirect",
    expression: "(http.host eq \"\($apex)\")",
    action_parameters: { from_value: { status_code: 301, preserve_query_string: true,
      target_url: { expression: "concat(\"https://\($www)\", http.request.uri.path)" } } } }')
  body=$(jq -nc --argjson rules "$rules" --argjson rule "$rule" '{rules: ($rules | map(del(.id, .version, .last_updated, .ref)) + [$rule])}')
  r=$(cf -X PUT "$phase" -d "$body")
  if ok "$r"; then echo "Redirect: $APEX -> $WWW"; else echo "Redirect failed: $(errors "$r")"; exit 1; fi
fi

# Where each domain stands (Cloudflare checks DNS and issues the certificate; this can take a few minutes).
cf "$API/accounts/$CLOUDFLARE_ACCOUNT_ID/pages/projects/$PROJECT/domains" | jq -r '.result[]? | "\(.name): \(.status)"'
