#!/usr/bin/env node
// Meta Ads Read-Only MCP server - raw JSON-RPC over stdio
import { createInterface } from "node:readline";
import {
  getMe, listPages, listInstagramAccounts, listPermissions, debugToken,
  // Ads API (read-only)
  listAdAccounts, getAdAccount,
  listCampaigns, getCampaign,
  listAdSets, getAdSet,
  listAds, getAd, getAdPreview,
  listAdCreatives, getAdCreative,
  listAdImages,
  listCustomAudiences, getCustomAudience, listSavedAudiences,
  getAdAccountInsights, getCampaignInsights, getAdSetInsights, getAdInsights,
  listPixels, getPixel,
  listProductCatalogs, getProductCatalog, listCatalogProducts,
  listLeadGenForms, getLeadGenForm, getLeads,
  listAdRules, getAdRule,
  searchTargeting, getReachEstimate,
  formatJson,
} from "./core";

const SERVER_INFO = { name: "meta-ads-readonly", version: "1.0.0" };

const TOOLS = [
  // ═══ ACCOUNT & DISCOVERY ═══
  {
    name: "meta_get_me",
    description: "Get the authenticated Meta user profile (name, email, ID).",
    inputSchema: { type: "object", properties: { fields: { type: "string", description: "Comma-separated fields" } } },
  },
  {
    name: "meta_list_pages",
    description: "List Facebook Pages the authenticated user manages. Returns page IDs, names, access tokens, and follower counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "meta_list_instagram_accounts",
    description: "List Instagram Business/Creator accounts connected to your Facebook Pages. Returns IG account IDs, usernames, bios, follower counts.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "meta_list_permissions",
    description: "List all permissions/scopes granted to the current access token.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "meta_debug_token",
    description: "Debug the current access token: expiry, scopes, app info, validity.",
    inputSchema: { type: "object", properties: {} },
  },

  // ═══ ADS - AD ACCOUNTS ═══
  {
    name: "ads_list_accounts",
    description: "List ad accounts the authenticated user has access to.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ads_get_account",
    description: "Get details of an ad account (status, currency, spend, balance).",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID (with or without act_ prefix)" } },
      required: ["account_id"],
    },
  },

  // ═══ ADS - CAMPAIGNS ═══
  {
    name: "ads_list_campaigns",
    description: "List ad campaigns in an ad account.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account ID" },
        status: { type: "array", items: { type: "string" }, description: "Filter by status: ACTIVE, PAUSED, DELETED, ARCHIVED" },
        fields: { type: "string", description: "Fields to return" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_campaign",
    description: "Get a specific ad campaign.",
    inputSchema: {
      type: "object",
      properties: { campaign_id: { type: "string", description: "Campaign ID" } },
      required: ["campaign_id"],
    },
  },

  // ═══ ADS - AD SETS ═══
  {
    name: "ads_list_adsets",
    description: "List ad sets in an ad account (with targeting, budgets, optimization).",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account ID" },
        campaign_id: { type: "string", description: "Filter by campaign" },
        status: { type: "array", items: { type: "string" }, description: "Filter by status" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_adset",
    description: "Get a specific ad set (targeting spec, budget, optimization goal).",
    inputSchema: {
      type: "object",
      properties: { adset_id: { type: "string", description: "Ad Set ID" } },
      required: ["adset_id"],
    },
  },

  // ═══ ADS - ADS ═══
  {
    name: "ads_list_ads",
    description: "List ads in an ad account.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account ID" },
        adset_id: { type: "string", description: "Filter by ad set" },
        campaign_id: { type: "string", description: "Filter by campaign" },
        status: { type: "array", items: { type: "string" }, description: "Filter by status" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_ad",
    description: "Get a specific ad (creative, tracking, status).",
    inputSchema: {
      type: "object",
      properties: { ad_id: { type: "string", description: "Ad ID" } },
      required: ["ad_id"],
    },
  },
  {
    name: "ads_preview_ad",
    description: "Preview how an ad looks in different placements.",
    inputSchema: {
      type: "object",
      properties: {
        ad_id: { type: "string", description: "Ad ID" },
        ad_format: { type: "string", description: "Format: DESKTOP_FEED_STANDARD, MOBILE_FEED_STANDARD, RIGHT_COLUMN_STANDARD, INSTAGRAM_STANDARD, INSTAGRAM_STORY, etc." },
      },
      required: ["ad_id"],
    },
  },

  // ═══ ADS - CREATIVES ═══
  {
    name: "ads_list_creatives",
    description: "List ad creatives in an ad account.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_creative",
    description: "Get a specific ad creative (image, video, text, links).",
    inputSchema: {
      type: "object",
      properties: { creative_id: { type: "string", description: "Creative ID" } },
      required: ["creative_id"],
    },
  },

  // ═══ ADS - IMAGES ═══
  {
    name: "ads_list_images",
    description: "List ad images uploaded to an ad account.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },

  // ═══ ADS - AUDIENCES ═══
  {
    name: "ads_list_audiences",
    description: "List custom audiences in an ad account.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_audience",
    description: "Get details of a custom audience (size, subtype, rules).",
    inputSchema: {
      type: "object",
      properties: { audience_id: { type: "string", description: "Audience ID" } },
      required: ["audience_id"],
    },
  },
  {
    name: "ads_list_saved_audiences",
    description: "List saved audiences (pre-configured targeting specs).",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },

  // ═══ ADS - INSIGHTS ═══
  {
    name: "ads_account_insights",
    description: "Get ad account performance insights (impressions, clicks, spend, conversions, ROAS).",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account ID" },
        date_preset: { type: "string", description: "Preset: today, yesterday, last_7d, last_30d, last_90d, this_month, last_month" },
        since: { type: "string", description: "Start date (YYYY-MM-DD)" },
        until: { type: "string", description: "End date (YYYY-MM-DD)" },
        fields: { type: "string", description: "Metrics to return" },
        breakdowns: { type: "string", description: "Breakdowns: age, gender, country, publisher_platform, platform_position, device_platform, impression_device" },
        level: { type: "string", description: "Aggregate at: account, campaign, adset, ad" },
        time_increment: { type: "string", description: "Time granularity: monthly, 1 (daily), 7 (weekly), or all_days" },
      },
      required: ["account_id"],
    },
  },
  {
    name: "ads_campaign_insights",
    description: "Get campaign performance insights.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", description: "Campaign ID" },
        date_preset: { type: "string", description: "Date preset" },
        since: { type: "string", description: "Start date" },
        until: { type: "string", description: "End date" },
        fields: { type: "string", description: "Metrics" },
        breakdowns: { type: "string", description: "Breakdowns" },
        time_increment: { type: "string", description: "Time granularity: monthly, 1 (daily), 7 (weekly), or all_days" },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "ads_adset_insights",
    description: "Get ad set performance insights.",
    inputSchema: {
      type: "object",
      properties: {
        adset_id: { type: "string", description: "Ad Set ID" },
        date_preset: { type: "string", description: "Date preset" },
        since: { type: "string", description: "Start date" },
        until: { type: "string", description: "End date" },
        fields: { type: "string", description: "Metrics" },
        breakdowns: { type: "string", description: "Breakdowns" },
        time_increment: { type: "string", description: "Time granularity: monthly, 1 (daily), 7 (weekly), or all_days" },
      },
      required: ["adset_id"],
    },
  },
  {
    name: "ads_ad_insights",
    description: "Get individual ad performance insights (includes video metrics).",
    inputSchema: {
      type: "object",
      properties: {
        ad_id: { type: "string", description: "Ad ID" },
        date_preset: { type: "string", description: "Date preset" },
        since: { type: "string", description: "Start date" },
        until: { type: "string", description: "End date" },
        fields: { type: "string", description: "Metrics" },
        breakdowns: { type: "string", description: "Breakdowns" },
        time_increment: { type: "string", description: "Time granularity: monthly, 1 (daily), 7 (weekly), or all_days" },
      },
      required: ["ad_id"],
    },
  },

  // ═══ ADS - PIXELS ═══
  {
    name: "ads_list_pixels",
    description: "List tracking pixels in an ad account.",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_pixel",
    description: "Get pixel details (code, last fired, matching config).",
    inputSchema: {
      type: "object",
      properties: { pixel_id: { type: "string", description: "Pixel ID" } },
      required: ["pixel_id"],
    },
  },

  // ═══ ADS - PRODUCT CATALOGS ═══
  {
    name: "ads_list_catalogs",
    description: "List product catalogs (for dynamic ads, shopping).",
    inputSchema: {
      type: "object",
      properties: { business_id: { type: "string", description: "Business ID" } },
      required: ["business_id"],
    },
  },
  {
    name: "ads_get_catalog",
    description: "Get product catalog details.",
    inputSchema: {
      type: "object",
      properties: { catalog_id: { type: "string", description: "Catalog ID" } },
      required: ["catalog_id"],
    },
  },
  {
    name: "ads_list_products",
    description: "List products in a catalog.",
    inputSchema: {
      type: "object",
      properties: { catalog_id: { type: "string", description: "Catalog ID" } },
      required: ["catalog_id"],
    },
  },

  // ═══ ADS - LEAD GEN ═══
  {
    name: "ads_list_lead_forms",
    description: "List lead generation forms for a Page.",
    inputSchema: {
      type: "object",
      properties: { page_id: { type: "string", description: "Facebook Page ID" } },
      required: ["page_id"],
    },
  },
  {
    name: "ads_get_lead_form",
    description: "Get a lead gen form (questions, privacy policy, thank you page).",
    inputSchema: {
      type: "object",
      properties: { form_id: { type: "string", description: "Lead Gen Form ID" } },
      required: ["form_id"],
    },
  },
  {
    name: "ads_get_leads",
    description: "Get captured leads from a lead gen form (contact data, associated ad/campaign info).",
    inputSchema: {
      type: "object",
      properties: { form_id: { type: "string", description: "Lead Gen Form ID" } },
      required: ["form_id"],
    },
  },

  // ═══ ADS - RULES ═══
  {
    name: "ads_list_rules",
    description: "List automated ad rules (performance-based automations).",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "string", description: "Ad account ID" } },
      required: ["account_id"],
    },
  },
  {
    name: "ads_get_rule",
    description: "Get an ad rule (conditions, actions, schedule).",
    inputSchema: {
      type: "object",
      properties: { rule_id: { type: "string", description: "Rule ID" } },
      required: ["rule_id"],
    },
  },

  // ═══ ADS - TARGETING ═══
  {
    name: "ads_search_targeting",
    description: "Search for targeting options (interests, behaviors, employers, job titles, education). Types: adinterest, adinterestsuggestion, adeducationschool, adworkemployer, adworkposition, adlocale, adcountry, adregion, adcity, adzipcode.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Search type (e.g. adinterest, adworkemployer, adcountry)" },
        query: { type: "string", description: "Search query" },
        limit: { type: "number", description: "Max results" },
      },
      required: ["type", "query"],
    },
  },
  {
    name: "ads_reach_estimate",
    description: "Estimate the reach of a targeting spec before creating an ad set.",
    inputSchema: {
      type: "object",
      properties: {
        account_id: { type: "string", description: "Ad account ID" },
        targeting_spec: { type: "object", description: "Targeting spec: {geo_locations:{countries:['US']}, age_min:25, age_max:55}" },
        optimization_goal: { type: "string", description: "Optimization goal (optional)" },
      },
      required: ["account_id", "targeting_spec"],
    },
  },
];

async function handleTool(name: string, args: Record<string, any>): Promise<string> {
  switch (name) {
    // Account & Discovery
    case "meta_get_me": return formatJson(await getMe(args.fields));
    case "meta_list_pages": return formatJson(await listPages());
    case "meta_list_instagram_accounts": return formatJson(await listInstagramAccounts());
    case "meta_list_permissions": return formatJson(await listPermissions());
    case "meta_debug_token": return formatJson(await debugToken());

    // Ads - Accounts
    case "ads_list_accounts": return formatJson(await listAdAccounts());
    case "ads_get_account": return formatJson(await getAdAccount(args.account_id));

    // Ads - Campaigns
    case "ads_list_campaigns": return formatJson(await listCampaigns(args.account_id, { status: args.status, fields: args.fields }));
    case "ads_get_campaign": return formatJson(await getCampaign(args.campaign_id));

    // Ads - Ad Sets
    case "ads_list_adsets": return formatJson(await listAdSets(args.account_id, { campaign_id: args.campaign_id, status: args.status }));
    case "ads_get_adset": return formatJson(await getAdSet(args.adset_id));

    // Ads - Ads
    case "ads_list_ads": return formatJson(await listAds(args.account_id, { adset_id: args.adset_id, campaign_id: args.campaign_id, status: args.status }));
    case "ads_get_ad": return formatJson(await getAd(args.ad_id));
    case "ads_preview_ad": return formatJson(await getAdPreview(args.ad_id, args.ad_format));

    // Ads - Creatives
    case "ads_list_creatives": return formatJson(await listAdCreatives(args.account_id));
    case "ads_get_creative": return formatJson(await getAdCreative(args.creative_id));

    // Ads - Images
    case "ads_list_images": return formatJson(await listAdImages(args.account_id));

    // Ads - Audiences
    case "ads_list_audiences": return formatJson(await listCustomAudiences(args.account_id));
    case "ads_get_audience": return formatJson(await getCustomAudience(args.audience_id));
    case "ads_list_saved_audiences": return formatJson(await listSavedAudiences(args.account_id));

    // Ads - Insights
    case "ads_account_insights": return formatJson(await getAdAccountInsights(args.account_id, {
      date_preset: args.date_preset,
      time_range: args.since && args.until ? { since: args.since, until: args.until } : undefined,
      fields: args.fields, breakdowns: args.breakdowns, level: args.level, time_increment: args.time_increment,
    }));
    case "ads_campaign_insights": return formatJson(await getCampaignInsights(args.campaign_id, {
      date_preset: args.date_preset,
      time_range: args.since && args.until ? { since: args.since, until: args.until } : undefined,
      fields: args.fields, breakdowns: args.breakdowns, time_increment: args.time_increment,
    }));
    case "ads_adset_insights": return formatJson(await getAdSetInsights(args.adset_id, {
      date_preset: args.date_preset,
      time_range: args.since && args.until ? { since: args.since, until: args.until } : undefined,
      fields: args.fields, breakdowns: args.breakdowns, time_increment: args.time_increment,
    }));
    case "ads_ad_insights": return formatJson(await getAdInsights(args.ad_id, {
      date_preset: args.date_preset,
      time_range: args.since && args.until ? { since: args.since, until: args.until } : undefined,
      fields: args.fields, breakdowns: args.breakdowns, time_increment: args.time_increment,
    }));

    // Ads - Pixels
    case "ads_list_pixels": return formatJson(await listPixels(args.account_id));
    case "ads_get_pixel": return formatJson(await getPixel(args.pixel_id));

    // Ads - Catalogs
    case "ads_list_catalogs": return formatJson(await listProductCatalogs(args.business_id));
    case "ads_get_catalog": return formatJson(await getProductCatalog(args.catalog_id));
    case "ads_list_products": return formatJson(await listCatalogProducts(args.catalog_id));

    // Ads - Lead Gen
    case "ads_list_lead_forms": return formatJson(await listLeadGenForms(args.page_id));
    case "ads_get_lead_form": return formatJson(await getLeadGenForm(args.form_id));
    case "ads_get_leads": return formatJson(await getLeads(args.form_id));

    // Ads - Rules
    case "ads_list_rules": return formatJson(await listAdRules(args.account_id));
    case "ads_get_rule": return formatJson(await getAdRule(args.rule_id));

    // Ads - Targeting
    case "ads_search_targeting": return formatJson(await searchTargeting(args.type, args.query, { limit: args.limit }));
    case "ads_reach_estimate": return formatJson(await getReachEstimate(args.account_id, args.targeting_spec, args.optimization_goal));

    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC ──
function sendResponse(id: number | string, result: any) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function sendError(id: number | string | null, code: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

async function handleMessage(raw: string) {
  let msg: any;
  try { msg = JSON.parse(raw); } catch { sendError(null, -32700, "Parse error"); return; }
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    switch (method) {
      case "initialize":
        sendResponse(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: SERVER_INFO });
        break;
      case "tools/list":
        sendResponse(id, { tools: TOOLS });
        break;
      case "tools/call": {
        const { name, arguments: args } = params;
        try {
          const text = await handleTool(name, args || {});
          sendResponse(id, { content: [{ type: "text", text }] });
        } catch (err: any) {
          sendResponse(id, { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true });
        }
        break;
      }
      case "ping": sendResponse(id, {}); break;
      default: sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) { sendError(id, -32603, err.message); }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on("line", (line) => { if (line.trim()) handleMessage(line.trim()); });
