#!/bin/sh
# AURION Keycloak realm bootstrap (ADR-033). Idempotent-ish: run once
# after the keycloak service is healthy. Required env:
#   KC_URL        e.g. http://localhost:8080/auth (inside the container: http://localhost:8080/auth)
#   KC_ADMIN_PASSWORD
#   PUBLIC_URL    e.g. https://aurion.example.com  (dashboard origin)
#   TENANT_ID     the production tenant uuid
#   ADMIN_EMAIL   Daniel's login email
#   GATEWAY_CLIENT_SECRET  secret for the voice-gateway machine client
#
# Usage on the VPS:
#   docker compose exec -T -e ... keycloak sh /tmp/keycloak-bootstrap.sh
set -eu

KCADM=/opt/keycloak/bin/kcadm.sh

$KCADM config credentials --server "$KC_URL" --realm master --user admin --password "$KC_ADMIN_PASSWORD"

# --- Realm -------------------------------------------------------------
$KCADM create realms -s realm=aurion -s enabled=true -s accessTokenLifespan=3600 2>/dev/null || echo "realm exists"

# Keycloak 24+ SILENTLY DROPS unmanaged user attributes unless the realm
# user profile allows them — found live: the admin user lost tenant_id/
# aurion_role and every dashboard call answered 403. Enable BEFORE users.
$KCADM get realms/aurion/users/profile > /tmp/up.json
sed 's/^{/{"unmanagedAttributePolicy":"ENABLED",/' /tmp/up.json > /tmp/up-enabled.json
$KCADM update realms/aurion/users/profile -f /tmp/up-enabled.json
echo "unmanaged attributes enabled"

# --- Dashboard: PUBLIC client, Authorization Code + PKCE (ADR-021) ------
$KCADM create clients -r aurion \
  -s clientId=aurion-dashboard \
  -s publicClient=true \
  -s standardFlowEnabled=true \
  -s directAccessGrantsEnabled=false \
  -s 'attributes={"pkce.code.challenge.method":"S256"}' \
  -s "redirectUris=[\"$PUBLIC_URL/callback\"]" \
  -s "webOrigins=[\"$PUBLIC_URL\"]" 2>/dev/null || echo "dashboard client exists"
DASH_ID=$($KCADM get clients -r aurion -q clientId=aurion-dashboard --fields id --format csv --noquotes | head -1)

# --- Voice gateway: CONFIDENTIAL client, client_credentials -------------
$KCADM create clients -r aurion \
  -s clientId=aurion-voice-gateway \
  -s publicClient=false \
  -s serviceAccountsEnabled=true \
  -s standardFlowEnabled=false \
  -s "secret=$GATEWAY_CLIENT_SECRET" 2>/dev/null || echo "gateway client exists"
GW_ID=$($KCADM get clients -r aurion -q clientId=aurion-voice-gateway --fields id --format csv --noquotes | head -1)

# --- Claim mappers: the ADR-007 contract (tenant_id, role, actor_type) --
mapper() { # clientUuid name json
  $KCADM create "clients/$1/protocol-mappers/models" -r aurion -b "$3" 2>/dev/null || echo "mapper $2 exists"
}

AUD='{"name":"aud-aurion-api","protocol":"openid-connect","protocolMapper":"oidc-audience-mapper","config":{"included.custom.audience":"aurion-api","access.token.claim":"true"}}'
mapper "$DASH_ID" aud "$AUD"
mapper "$GW_ID" aud "$AUD"

# Users carry tenant_id/role as attributes → claims.
mapper "$DASH_ID" tenant '{"name":"tenant-id","protocol":"openid-connect","protocolMapper":"oidc-usermodel-attribute-mapper","config":{"user.attribute":"tenant_id","claim.name":"tenant_id","jsonType.label":"String","access.token.claim":"true"}}'
mapper "$DASH_ID" role '{"name":"aurion-role","protocol":"openid-connect","protocolMapper":"oidc-usermodel-attribute-mapper","config":{"user.attribute":"aurion_role","claim.name":"role","jsonType.label":"String","access.token.claim":"true"}}'
mapper "$DASH_ID" actor '{"name":"actor-type","protocol":"openid-connect","protocolMapper":"oidc-hardcoded-claim-mapper","config":{"claim.name":"actor_type","claim.value":"user","jsonType.label":"String","access.token.claim":"true"}}'

# The machine client is ALWAYS a voice_agent for the fixed tenant.
mapper "$GW_ID" actor '{"name":"actor-type","protocol":"openid-connect","protocolMapper":"oidc-hardcoded-claim-mapper","config":{"claim.name":"actor_type","claim.value":"voice_agent","jsonType.label":"String","access.token.claim":"true"}}'
mapper "$GW_ID" tenant "{\"name\":\"tenant-id\",\"protocol\":\"openid-connect\",\"protocolMapper\":\"oidc-hardcoded-claim-mapper\",\"config\":{\"claim.name\":\"tenant_id\",\"claim.value\":\"$TENANT_ID\",\"jsonType.label\":\"String\",\"access.token.claim\":\"true\"}}"

# --- Daniel: tenant_admin ------------------------------------------------
$KCADM create users -r aurion \
  -s "username=$ADMIN_EMAIL" -s "email=$ADMIN_EMAIL" -s enabled=true -s emailVerified=true \
  -s "attributes={\"tenant_id\":\"$TENANT_ID\",\"aurion_role\":\"tenant_admin\"}" 2>/dev/null || echo "admin user exists"

echo "bootstrap complete. Set the admin password with:"
echo "  kcadm.sh set-password -r aurion --username $ADMIN_EMAIL --new-password <pwd>"
