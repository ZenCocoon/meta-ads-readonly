# Meta Ads Read-Only MCP Server

[![npm version](https://img.shields.io/npm/v/@sebgrosjean/meta-ads-readonly.svg)](https://www.npmjs.com/package/@sebgrosjean/meta-ads-readonly)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

Safe, read-only access to the Meta Marketing API for reporting, analysis, and monitoring. No create, update, or delete operations — ideal for dashboards, performance reviews, and auditing.

## Features

- **36 read-only tools** — ad accounts, campaigns, ad sets, ads, creatives, audiences, insights, pixels, catalogs, lead forms, rules, and targeting
- **Zero production dependencies** — pure TypeScript using native `fetch`
- **Performance insights** — impressions, clicks, spend, conversions, ROAS with date ranges and breakdowns
- **Safe by design** — intentionally excludes all mutating operations
- **MCP server** — works with Claude Desktop, Claude Code, Claude CoWork, Cursor, and other MCP clients
- **MCPB package** — one-click install for Claude CoWork / Claude Desktop Extensions

## Requirements

- Node.js >= 18
- A Meta Access Token with `ads_read` permission ([setup guide below](#getting-a-meta-access-token))

## Installation

### Claude Code

```bash
claude mcp add meta-ads-readonly -- npx -y @sebgrosjean/meta-ads-readonly@latest
```

Then set the token in your environment or pass it via env config.

### Claude Desktop / Cursor

Add to your MCP config (`~/.claude/claude_desktop_config.json` or `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "meta-ads-readonly": {
      "command": "npx",
      "args": ["-y", "@sebgrosjean/meta-ads-readonly@latest"],
      "env": {
        "META_ACCESS_TOKEN": "your-meta-access-token"
      }
    }
  }
}
```

### Claude CoWork (MCPB)

Download `meta-ads-readonly.mcpb` from the [latest release](https://github.com/ZenCocoon/meta-ads-readonly/releases) and install it in Claude CoWork. No npm or Node.js setup required.

### From Source

```bash
git clone https://github.com/ZenCocoon/meta-ads-readonly.git
cd meta-ads-readonly && npm install && npm run build
META_ACCESS_TOKEN="your-token" node dist/mcp-bundled.js
```

## Getting a Meta Access Token

1. Go to [developers.facebook.com](https://developers.facebook.com) — create an app if you don't have one (type: **Business**, takes 30 seconds)
2. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer)
3. Select your app, click **Generate Access Token**, and grant the permissions below
4. Copy the generated token

No Marketing API product setup or app review needed for reading your own ad accounts. The token is valid for ~60 days.

### Permissions

| Permission | Required? | Dependencies | What it unlocks |
|---|---|---|---|
| **`ads_read`** | **Required** | None | All ad account, campaign, ad set, ad, creative, audience, insight, pixel, rule, and targeting tools |
| **`pages_show_list`** | Recommended | None | `meta_list_pages`, `meta_list_instagram_accounts`, and lead form tools |
| **`pages_read_engagement`** | Optional | `pages_show_list` | Richer Page data (posts, followers, metadata) |
| **`business_management`** | Optional | `pages_read_engagement`, `pages_show_list` | `ads_list_catalogs` (product catalogs are business-level assets) |

> **Note on `leads_retrieval`:** Retrieving captured lead data (`ads_get_leads`) requires the `leads_retrieval` permission, which depends on `ads_management` (a write permission). Since this is a read-only server, most users won't have this scope. The tool is included for users who do, but it will return an error without it.

## MCP Tools

### Account & Discovery

| Tool | Description |
|------|-------------|
| `meta_get_me` | Get authenticated user profile (name, email, ID) |
| `meta_list_pages` | List Facebook Pages you manage |
| `meta_list_instagram_accounts` | List connected Instagram Business/Creator accounts |
| `meta_list_permissions` | List permissions granted to the current token |
| `meta_debug_token` | Debug token: expiry, scopes, app info, validity |

### Ad Accounts

| Tool | Description |
|------|-------------|
| `ads_list_accounts` | List ad accounts you have access to |
| `ads_get_account` | Get account details (status, currency, spend, balance) |

### Campaigns

| Tool | Description |
|------|-------------|
| `ads_list_campaigns` | List campaigns in an ad account (filterable by status) |
| `ads_get_campaign` | Get a specific campaign |

### Ad Sets

| Tool | Description |
|------|-------------|
| `ads_list_adsets` | List ad sets (targeting, budgets, optimization) |
| `ads_get_adset` | Get ad set details (targeting spec, budget, optimization goal) |

### Ads & Creatives

| Tool | Description |
|------|-------------|
| `ads_list_ads` | List ads (filterable by ad set, campaign, status) |
| `ads_get_ad` | Get ad details (creative, tracking, status) |
| `ads_preview_ad` | Preview ad in different placements |
| `ads_list_creatives` | List ad creatives |
| `ads_get_creative` | Get creative details (image, video, text, links) |
| `ads_list_images` | List uploaded ad images |

### Audiences

| Tool | Description |
|------|-------------|
| `ads_list_audiences` | List custom audiences |
| `ads_get_audience` | Get audience details (size, subtype, rules) |
| `ads_list_saved_audiences` | List saved audiences (pre-configured targeting) |

### Performance Insights

| Tool | Description |
|------|-------------|
| `ads_account_insights` | Account-level metrics (impressions, clicks, spend, conversions, ROAS) |
| `ads_campaign_insights` | Campaign performance insights |
| `ads_adset_insights` | Ad set performance insights |
| `ads_ad_insights` | Individual ad performance (includes video metrics) |

All insight tools support `date_preset` (e.g. `last_7d`, `last_30d`), custom date ranges (`since`/`until`), field selection, and breakdowns (age, gender, country, platform, device).

### Pixels & Tracking

| Tool | Description |
|------|-------------|
| `ads_list_pixels` | List tracking pixels |
| `ads_get_pixel` | Get pixel details (code, last fired, matching config) |

### Product Catalogs

| Tool | Description |
|------|-------------|
| `ads_list_catalogs` | List product catalogs (dynamic ads, shopping) |
| `ads_get_catalog` | Get catalog details |
| `ads_list_products` | List products in a catalog |

### Lead Generation

| Tool | Description |
|------|-------------|
| `ads_list_lead_forms` | List lead gen forms for a Page |
| `ads_get_lead_form` | Get form details (questions, privacy policy) |
| `ads_get_leads` | Get captured leads (contact data, ad/campaign info) |

### Automation Rules

| Tool | Description |
|------|-------------|
| `ads_list_rules` | List automated ad rules |
| `ads_get_rule` | Get rule details (conditions, actions, schedule) |

### Targeting & Reach

| Tool | Description |
|------|-------------|
| `ads_search_targeting` | Search targeting options (interests, behaviors, demographics, locations) |
| `ads_reach_estimate` | Estimate audience reach for a targeting spec |

## License

[MIT](LICENSE)
