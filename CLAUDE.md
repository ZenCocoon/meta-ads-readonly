# Meta Ads Read-Only MCP Server

TypeScript MCP server for the Meta Marketing API (Graph API v22.0). Read-only — no create, update, or delete operations.

**Requires:** `META_ACCESS_TOKEN` environment variable

## Setup

```bash
npm install && npm run build
```

### MCP Server (stdio)

```bash
claude mcp add meta-ads-readonly -- node /path/to/dist/mcp-bundled.js
```

Or run directly:

```bash
META_ACCESS_TOKEN="your-token" node dist/mcp-bundled.js
```

## Getting a Meta Access Token

1. Go to [developers.facebook.com](https://developers.facebook.com) — create an app if you don't have one (type: Business, takes 30 seconds)
2. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer)
3. Select your app, click **Generate Access Token**, and grant the permissions below
4. Copy the token

No Marketing API product setup or app review needed for reading your own ad accounts. The token is valid for ~60 days.

### Permissions

| Permission | Required? | What it unlocks |
|---|---|---|
| **`ads_read`** | **Required** | All `ads_*` tools (campaigns, ad sets, ads, insights, audiences, pixels, rules, targeting) |
| **`pages_show_list`** | Recommended | `meta_list_pages`, `meta_list_instagram_accounts`, lead form tools |
| **`pages_read_engagement`** | Optional | Richer Page data (posts, followers, metadata). Dependency for `business_management` |
| **`business_management`** | Optional | `ads_list_catalogs` (product catalogs are business-level assets) |

> `leads_retrieval` (needed for `ads_get_leads`) depends on `ads_management` (a write permission), so most read-only users won't have it.

## Architecture

- `src/core.ts` — Meta Graph API HTTP client. Pure TypeScript, no dependencies. Handles auth, pagination (up to 50 pages), error formatting.
- `src/mcp.ts` — MCP server over stdio (JSON-RPC 2.0). Maps 36 tools to core functions.

## MCP Tools (36 total, all read-only)

### Account & Discovery

| Tool | Description |
|------|-------------|
| `meta_get_me` | Authenticated user profile |
| `meta_list_pages` | Facebook Pages you manage |
| `meta_list_instagram_accounts` | Connected Instagram accounts |
| `meta_list_permissions` | Token permissions/scopes |
| `meta_debug_token` | Token expiry, scopes, validity |

### Ad Accounts & Structure

| Tool | Description |
|------|-------------|
| `ads_list_accounts` | List ad accounts |
| `ads_get_account` | Account details (status, currency, spend) |
| `ads_list_campaigns` | List campaigns (filterable by status) |
| `ads_get_campaign` | Campaign details |
| `ads_list_adsets` | List ad sets (filterable by campaign, status) |
| `ads_get_adset` | Ad set details (targeting, budget) |
| `ads_list_ads` | List ads (filterable by ad set, campaign, status) |
| `ads_get_ad` | Ad details (creative, tracking) |
| `ads_preview_ad` | Preview ad in placements (DESKTOP_FEED_STANDARD, MOBILE_FEED_STANDARD, INSTAGRAM_STANDARD, INSTAGRAM_STORY, etc.) |

### Creatives & Images

| Tool | Description |
|------|-------------|
| `ads_list_creatives` | List ad creatives |
| `ads_get_creative` | Creative details (image, video, text, links) |
| `ads_list_images` | Uploaded ad images |

### Audiences

| Tool | Description |
|------|-------------|
| `ads_list_audiences` | Custom audiences |
| `ads_get_audience` | Audience details (size, subtype, rules) |
| `ads_list_saved_audiences` | Saved audiences (targeting specs) |

### Performance Insights

| Tool | Parameters | Description |
|------|-----------|-------------|
| `ads_account_insights` | account_id, date_preset, since/until, fields, breakdowns, level | Account metrics |
| `ads_campaign_insights` | campaign_id, date_preset, since/until, fields, breakdowns | Campaign metrics |
| `ads_adset_insights` | adset_id, date_preset, since/until, fields, breakdowns | Ad set metrics |
| `ads_ad_insights` | ad_id, date_preset, since/until, fields, breakdowns | Ad metrics (includes video) |

**Date presets:** today, yesterday, last_7d, last_30d, last_90d, this_month, last_month

**Breakdowns:** age, gender, country, publisher_platform, platform_position, device_platform, impression_device

### Pixels, Catalogs, Lead Gen, Rules, Targeting

| Tool | Description |
|------|-------------|
| `ads_list_pixels` / `ads_get_pixel` | Tracking pixels |
| `ads_list_catalogs` / `ads_get_catalog` / `ads_list_products` | Product catalogs |
| `ads_list_lead_forms` / `ads_get_lead_form` / `ads_get_leads` | Lead generation |
| `ads_list_rules` / `ads_get_rule` | Automated ad rules |
| `ads_search_targeting` | Search interests, behaviors, demographics, locations |
| `ads_reach_estimate` | Estimate audience reach for a targeting spec |

## Typical Workflow

1. Start with `meta_debug_token` to verify the token is valid and has the right permissions
2. Use `ads_list_accounts` to find available ad accounts
3. Use `ads_list_campaigns` with an account ID to browse campaigns
4. Drill into `ads_list_adsets` → `ads_list_ads` for structure
5. Use insight tools (`ads_account_insights`, etc.) for performance data with date ranges and breakdowns
