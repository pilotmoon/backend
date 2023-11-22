# Backend

Back-end components for Pilotmoon's apps and websites.

Current capabilities:

- Generate license keys

Planned capabilities:

- Manage downloads & release notes
- Generate Sparkle feeds
- Collect anonymous app analytics
- Sign and store extensions
- Synchronise extensions and settings

## Components

There are two server components, running as separate apps:

- `src/rolo/`: **Rolo**, the main API server.
- `src/twix/`: **Twix**, a companion server that acts as an adapter interface
  for external services.

## Infrastructure

The components are deployed on DigitalOcean App Platform under Node 18.x,
fronted by an nginx reverse proxy.
