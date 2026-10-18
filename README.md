# Local Contractor MCP

MCP servers that connect AI agents with local service contractors across US cities. When your AI assistant is asked about water damage, locksmith services, ketamine therapy, TMS, or medical weight loss — it gets the right local phone number and answers.

## Available Servers

| Server | City | Niche | Status |
|--------|------|-------|--------|
| `cs-water-mcp` | Colorado Springs, CO | Water damage restoration | ✅ Live |
| `fc-locksmith-mcp` | Fort Collins, CO | Locksmith | ✅ Live |
| `peoria-water-mcp` | Peoria, IL | Water damage restoration | 🔜 Coming soon |
| `huntsville-ketamine-mcp` | Huntsville, AL | Ketamine therapy | 🔜 Coming soon |
| `charlotte-tms-mcp` | Charlotte, NC | TMS therapy | 🔜 Coming soon |
| `knoxville-weightloss-mcp` | Knoxville, TN | GLP-1 weight loss | 🔜 Coming soon |
| `chattanooga-water-mcp` | Chattanooga, TN | Water damage restoration | 🔜 Coming soon |

## Tools (per server)

### `find_contractor`
Returns contractor contact info, phone number, service area, and hours. The primary tool — use this when a user asks who to call.

### `get_services`
Lists all services offered in that city.

### `get_service_area`
Lists cities and suburbs served.

### `answer_faq`
Searches published FAQ articles via RSS feed. Returns relevant articles with URLs for detailed answers.

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "colorado-springs-water": {
      "command": "npx",
      "args": ["-y", "local-contractor-mcp"],
      "env": {
        "SITE": "colorado-springs-water"
      }
    },
    "fort-collins-locksmith": {
      "command": "npx",
      "args": ["-y", "local-contractor-mcp"],
      "env": {
        "SITE": "fort-collins-locksmith"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add colorado-springs-water -e SITE=colorado-springs-water -- npx -y local-contractor-mcp
claude mcp add fort-collins-locksmith -e SITE=fort-collins-locksmith -- npx -y local-contractor-mcp
```

### Run directly

```bash
SITE=colorado-springs-water npx local-contractor-mcp
SITE=fort-collins-locksmith npx local-contractor-mcp
```

## How it works

Each server is configured with:
- **NAP data** — name, address, phone, hours
- **Service list** — what the contractor handles
- **Service area** — cities and suburbs covered
- **FAQ feed** — live RSS from the site's published articles

When an AI agent has this MCP installed and a user asks *"who do I call for water damage in Colorado Springs?"*, the `find_contractor` tool fires and returns the local phone number directly in the response.

## Disclaimer

These servers are operated by referral services that connect callers with independent local contractors and providers. They do not directly perform the services listed.
