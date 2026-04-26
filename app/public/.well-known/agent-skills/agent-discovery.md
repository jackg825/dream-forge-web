---
name: dream-forge-agent-discovery
description: Discover Dream Forge crawler preferences, markdown alternates, WebMCP tools, MCP card, and agent skills.
---

# Dream Forge Agent Discovery

Use this skill when checking Dream Forge's agent-facing discovery surface.

## Resources

- Robots policy: `https://dreamforge.app/robots.txt`
- Sitemap: `https://dreamforge.app/sitemap.xml`
- Homepage markdown alternate: `https://dreamforge.app/index.md`
- Agent skills index: `https://dreamforge.app/.well-known/agent-skills/index.json`
- MCP server card: `https://dreamforge.app/.well-known/mcp/server-card.json`
- API catalog: `https://dreamforge.app/.well-known/api-catalog`

## WebMCP

The homepage registers browser tools on load with `navigator.modelContext.registerTool()` when the browser exposes WebMCP. Tools are read-only unless they explicitly navigate the user to a Dream Forge workflow.

## Content Use

Dream Forge allows search and user-directed AI input for public pages, and opts out of AI training in `robots.txt` via Content Signals.
