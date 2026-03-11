# Debian VPS Baseline (MVO)

Target OS: Debian 12

## Responsibilities

- Host orchestration plane services
- Run n8n and Paperclip adapter service
- Route urgent events to orchestration
- Enforce network hardening and trusted ingress

## Security baseline

- UFW enabled with least-privilege ports
- Tailscale for private service-to-service links
- Cloud Armor in front of public endpoints
- `.env`-based secret loading for MVO (vault migration in Phase 2)

## Bootstrapping

1. Install Docker Engine + Docker Compose plugin.
2. Install Tailscale and join private tailnet.
3. Configure UFW rules for SSH, Tailscale, and ingress proxy only.
4. Deploy services with `docker compose up -d`.
