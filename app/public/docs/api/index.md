---
title: Dream Forge API Documentation
canonical: https://dreamforge.app/docs/api/
---

# Dream Forge API Documentation

Dream Forge is a photo-to-3D web application. The public API catalog describes machine-readable discovery resources and the R2 storage proxy used by the app. Authenticated app workflows use Firebase Authentication ID tokens.

## Discovery

- API catalog: <https://dreamforge.app/.well-known/api-catalog>
- OpenAPI description: <https://dreamforge.app/.well-known/openapi.json>
- OAuth protected resource metadata: <https://dreamforge.app/.well-known/oauth-protected-resource>
- Agent skills index: <https://dreamforge.app/.well-known/agent-skills/index.json>
- MCP server card: <https://dreamforge.app/.well-known/mcp/server-card.json>

## Authentication

Protected APIs expect an `Authorization: Bearer <Firebase ID token>` header. Tokens are issued by `https://securetoken.google.com/dreamforge-66998` and signed with Google's Secure Token JWKS.

## Storage Proxy

The storage proxy is available at `https://dream-forge-r2-proxy.jackg825.workers.dev`.

```http
GET https://dream-forge-r2-proxy.jackg825.workers.dev/health
```

The OpenAPI document describes:

- `GET /health`
- `PUT /upload/direct`
- `POST /download/presign`
- `GET /public/{key}`
- `GET /download/{key}`
- `DELETE /delete/{key}`

## Markdown

This markdown file is a static alternate for agents. To make `Accept: text/markdown` return markdown for HTML pages, enable Cloudflare Markdown for Agents on the production zone or add an edge/function layer that performs content negotiation.
