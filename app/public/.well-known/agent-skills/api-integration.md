---
name: dream-forge-api-integration
description: Discover Dream Forge machine-readable API metadata and authenticated storage proxy behavior.
---

# Dream Forge API Integration

Use this skill when an agent or developer needs to discover Dream Forge API metadata.

## Discovery Order

1. Fetch `https://dreamforge.app/.well-known/api-catalog`.
2. Follow the `service-desc` link to `https://dreamforge.app/.well-known/openapi.json`.
3. Read `https://dreamforge.app/docs/api/` for human-oriented notes.
4. For protected resources, read `https://dreamforge.app/.well-known/oauth-protected-resource`.

## Authentication

Protected endpoints use Firebase Authentication ID tokens in the `Authorization` header:

```http
Authorization: Bearer <Firebase ID token>
```

Tokens are issued by `https://securetoken.google.com/dreamforge-66998`.

## Storage Proxy

The R2 proxy base URL is `https://dream-forge-r2-proxy.jackg825.workers.dev`. The OpenAPI document covers health, authenticated direct upload, short-lived download links, public download, signed/authenticated download, and delete operations.
