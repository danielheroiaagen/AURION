#!/bin/sh
# AURION VPS bootstrap (phase 19 go-live). Run ONCE as root from the
# Hostinger browser terminal:
#
#   curl -fsSL https://raw.githubusercontent.com/danielheroiaagen/AURION/main/10_DEPLOYMENT/vps-bootstrap.sh | sh
#
# It authorizes the operator's DEPLOY KEY for root over SSH (public keys
# are public by nature; the private half never leaves the operator's
# machine), installs Docker if missing, and clones the repo. Everything
# else (production .env, compose up, Twilio cutover) happens over SSH —
# see 10_DEPLOYMENT/vps-deploy-runbook.md.
set -eu

DEPLOY_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIH+SlHSRa9GUg71dYTqPgsLiSDZ2TdDITzO8nGJ2p+uP aurion-deploy"

mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
grep -qF "$DEPLOY_KEY" /root/.ssh/authorized_keys || echo "$DEPLOY_KEY" >> /root/.ssh/authorized_keys
echo "deploy key authorized."

if ! command -v docker >/dev/null 2>&1; then
  echo "installing docker…"
  curl -fsSL https://get.docker.com | sh
fi
docker --version

if ! command -v git >/dev/null 2>&1; then
  apt-get update -qq && apt-get install -y -qq git
fi

if [ ! -d /root/AURION/.git ]; then
  git clone https://github.com/danielheroiaagen/AURION.git /root/AURION
fi
echo "bootstrap complete: $(cd /root/AURION && git rev-parse --short HEAD)"
