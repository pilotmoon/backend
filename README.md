# Rolo

```text
                     ,--,
Pilotmoon API ==== ,--.'| ===========
  __  ,-.   ,---.  |  | :     ,---.
,' ,'/ /|  '   ,'\ :  : '    '   ,'\
'  | |' | /   /   ||  ' |   /   /   |
|  |   ,'.   ; ,. :'  | |  .   ; ,. :
'  :  /  '   | |: :|  | :  '   | |: :
|  | '   '   | .; :'  : |__'   | .; :
;  : |   |   :    ||  | '.'|   :    |
|  , ;    \   \  / ;  :    ;\   \  /
 ---'      `----'  |  ,   /  `----'
==================  ---`-' ======= v2
```

This API server is the back-end for Pilotmoon's apps and websites. It is written
in TypeScript and is built around Koa. Data is stored on a MongoDB cluster.

Current capabilities:

- Generate license keys

Planned capabilities:

- Manage downloads & release notes
- Generate Sparkle feeds
- Collect anonymous app analytics
- Sign and store extensions
- Synchronise extensions and settings

Rolo is named after a brand of chocolate-covered caramels.

## Components

There are two components, running as separate apps:

- `src/api/`: Rolo, the main API server.
- `src/webhooks/`: Twix, a companion server that acts as an adapter interface
  for external services.

## Infrastructure

The apps are designed to be deployed the DigitalOcean App Platform under Node
16.x, fronted by a reverse proxy (with rate-limiting) for access via a public
domain name.
