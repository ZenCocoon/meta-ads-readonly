// Meta Graph API client (Facebook + Instagram) - pure TypeScript, no dependencies

const API_VERSION = "v22.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// ── Auth ──

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN not set. Configure it in the extension settings.");
  return token;
}

// ── HTTP Client ──

async function request<T = any>(
  method: string,
  path: string,
  options: { query?: Record<string, any>; body?: Record<string, any>; formData?: boolean } = {}
): Promise<T> {
  const url = new URL(path.startsWith("http") ? path : `${BASE_URL}/${path.replace(/^\//, "")}`);

  // Always include access_token as query param (Meta's preferred method)
  url.searchParams.set("access_token", getAccessToken());

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) url.searchParams.set(k, v.join(","));
      else url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { "User-Agent": "meta-cli/1.0.0" };
  const fetchOpts: RequestInit = { method: method.toUpperCase(), headers };

  if (options.body && !["GET", "HEAD"].includes(method.toUpperCase())) {
    headers["Content-Type"] = "application/json";
    fetchOpts.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), fetchOpts);

  if (res.status === 204) return null as T;

  let data: any;
  try { data = await res.json(); }
  catch { data = await res.text().catch(() => null); }

  if (data?.error) {
    const e = data.error;
    throw new Error(`Meta API error (${e.code || res.status}): ${e.message}${e.error_subcode ? ` [subcode: ${e.error_subcode}]` : ""}`);
  }

  if (!res.ok) {
    const errStr = typeof data === "string" ? data : JSON.stringify(data);
    throw new Error(`Meta API error (${res.status}): ${errStr}`);
  }

  return data as T;
}

// Paginate through all results
async function paginate<T>(
  path: string,
  dataKey: string = "data",
  query: Record<string, any> = {},
  maxPages = 50
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = null;
  let page = 1;

  while (page <= maxPages) {
    const data: any = nextUrl
      ? await request("GET", nextUrl)
      : await request("GET", path, { query: { limit: 100, ...query } });

    const items: T[] = data[dataKey] || [];
    results.push(...items);

    if (data.paging?.next) {
      nextUrl = data.paging.next;
    } else {
      break;
    }
    page++;
  }
  return results;
}

// ── Account & Discovery ──

export async function getMe(fields?: string): Promise<any> {
  return request("GET", "me", { query: { fields: fields || "id,name,email" } });
}

export async function listPages(fields?: string): Promise<any[]> {
  return paginate("me/accounts", "data", {
    fields: fields || "id,name,access_token,category,followers_count,fan_count",
  });
}

export async function getPage(pageId: string, fields?: string): Promise<any> {
  return request("GET", pageId, {
    query: { fields: fields || "id,name,about,description,website,category,fan_count,followers_count,phone,emails,hours,location,single_line_address" },
  });
}

export async function getPageAccessToken(pageId: string): Promise<string> {
  const data: any = await request("GET", pageId, { query: { fields: "access_token" } });
  return data.access_token;
}

export async function listInstagramAccounts(): Promise<any[]> {
  const pages = await listPages("id,name,instagram_business_account{id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website}");
  return pages
    .filter((p: any) => p.instagram_business_account)
    .map((p: any) => ({ page_id: p.id, page_name: p.name, ...p.instagram_business_account }));
}

// ═══════════════════════════════════════════════════════
// INSTAGRAM
// ═══════════════════════════════════════════════════════

// ── Instagram Profile ──

export async function getInstagramAccount(igId: string, fields?: string): Promise<any> {
  return request("GET", igId, {
    query: { fields: fields || "id,name,username,biography,followers_count,follows_count,media_count,profile_picture_url,website" },
  });
}

// ── Instagram Media ──

export async function listInstagramMedia(igId: string, fields?: string, limit?: number): Promise<any[]> {
  return paginate(`${igId}/media`, "data", {
    fields: fields || "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
    ...(limit ? { limit } : {}),
  });
}

export async function getInstagramMedia(mediaId: string, fields?: string): Promise<any> {
  return request("GET", mediaId, {
    query: { fields: fields || "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,children{id,media_type,media_url}" },
  });
}

export async function deleteInstagramMedia(mediaId: string): Promise<void> {
  await request("DELETE", mediaId);
}

// ── Instagram Publishing ──

// Step 1: Create media container
export async function createInstagramMediaContainer(igId: string, params: {
  image_url?: string;
  video_url?: string;
  media_type?: "IMAGE" | "VIDEO" | "REELS" | "STORIES" | "CAROUSEL";
  caption?: string;
  is_carousel_item?: boolean;
  share_to_feed?: boolean; // For reels
  collaborators?: string[];
  location_id?: string;
  product_tags?: any[];
  cover_url?: string; // For reels/videos
  thumb_offset?: number; // For reels/videos (ms)
}): Promise<{ id: string }> {
  const body: Record<string, any> = {};
  if (params.image_url) body.image_url = params.image_url;
  if (params.video_url) body.video_url = params.video_url;
  if (params.media_type) body.media_type = params.media_type;
  if (params.caption) body.caption = params.caption;
  if (params.is_carousel_item) body.is_carousel_item = true;
  if (params.share_to_feed !== undefined) body.share_to_feed = params.share_to_feed;
  if (params.collaborators) body.collaborators = params.collaborators;
  if (params.location_id) body.location_id = params.location_id;
  if (params.product_tags) body.product_tags = params.product_tags;
  if (params.cover_url) body.cover_url = params.cover_url;
  if (params.thumb_offset !== undefined) body.thumb_offset = params.thumb_offset;
  return request("POST", `${igId}/media`, { body });
}

// Step 1b: Create carousel container (after creating item containers)
export async function createInstagramCarouselContainer(igId: string, params: {
  children: string[]; // Array of container IDs
  caption?: string;
  collaborators?: string[];
  location_id?: string;
}): Promise<{ id: string }> {
  return request("POST", `${igId}/media`, {
    body: {
      media_type: "CAROUSEL",
      children: params.children,
      caption: params.caption,
      collaborators: params.collaborators,
      location_id: params.location_id,
    },
  });
}

// Step 2: Publish the container
export async function publishInstagramMedia(igId: string, containerId: string): Promise<{ id: string }> {
  return request("POST", `${igId}/media_publish`, { body: { creation_id: containerId } });
}

// Check container status
export async function getContainerStatus(containerId: string): Promise<any> {
  return request("GET", containerId, { query: { fields: "id,status_code,status" } });
}

// Check publishing rate limit
export async function getPublishingLimit(igId: string): Promise<any> {
  return request("GET", `${igId}/content_publishing_limit`, { query: { fields: "config,quota_usage" } });
}

// High-level: publish a photo post
export async function publishInstagramPhoto(igId: string, imageUrl: string, caption?: string): Promise<any> {
  const container = await createInstagramMediaContainer(igId, { image_url: imageUrl, caption });
  return publishInstagramMedia(igId, container.id);
}

// High-level: publish a reel
export async function publishInstagramReel(igId: string, videoUrl: string, caption?: string, shareToFeed?: boolean, coverUrl?: string): Promise<any> {
  const container = await createInstagramMediaContainer(igId, {
    video_url: videoUrl,
    media_type: "REELS",
    caption,
    share_to_feed: shareToFeed,
    cover_url: coverUrl,
  });
  // Wait for video processing
  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 60) {
    await new Promise(r => setTimeout(r, 5000));
    const check = await getContainerStatus(container.id);
    status = check.status_code;
    if (status === "ERROR") throw new Error(`Reel processing failed: ${check.status}`);
    attempts++;
  }
  return publishInstagramMedia(igId, container.id);
}

// High-level: publish a story
export async function publishInstagramStory(igId: string, params: {
  image_url?: string;
  video_url?: string;
}): Promise<any> {
  const container = await createInstagramMediaContainer(igId, {
    ...params,
    media_type: "STORIES",
  });
  if (params.video_url) {
    let status = "IN_PROGRESS";
    let attempts = 0;
    while (status === "IN_PROGRESS" && attempts < 60) {
      await new Promise(r => setTimeout(r, 5000));
      const check = await getContainerStatus(container.id);
      status = check.status_code;
      if (status === "ERROR") throw new Error(`Story processing failed: ${check.status}`);
      attempts++;
    }
  }
  return publishInstagramMedia(igId, container.id);
}

// ── Instagram Comments ──

export async function listInstagramComments(mediaId: string, fields?: string): Promise<any[]> {
  return paginate(`${mediaId}/comments`, "data", {
    fields: fields || "id,text,username,timestamp,like_count,replies{id,text,username,timestamp}",
  });
}

export async function getInstagramComment(commentId: string, fields?: string): Promise<any> {
  return request("GET", commentId, {
    query: { fields: fields || "id,text,username,timestamp,like_count,parent_id,replies{id,text,username,timestamp}" },
  });
}

export async function replyToInstagramComment(mediaId: string, message: string): Promise<any> {
  return request("POST", `${mediaId}/comments`, { body: { message } });
}

export async function replyToInstagramCommentDirect(commentId: string, message: string): Promise<any> {
  return request("POST", `${commentId}/replies`, { body: { message } });
}

export async function deleteInstagramComment(commentId: string): Promise<void> {
  await request("DELETE", commentId);
}

export async function hideInstagramComment(commentId: string, hide: boolean = true): Promise<any> {
  return request("POST", commentId, { body: { hide } });
}

// ── Instagram Insights ──

export async function getInstagramAccountInsights(igId: string, params: {
  metric: string; // comma-separated metrics
  period: string; // day, week, days_28, month, lifetime
  since?: string;
  until?: string;
}): Promise<any> {
  return request("GET", `${igId}/insights`, {
    query: {
      metric: params.metric,
      period: params.period,
      since: params.since,
      until: params.until,
    },
  });
}

export async function getInstagramMediaInsights(mediaId: string, metric?: string): Promise<any> {
  return request("GET", `${mediaId}/insights`, {
    query: { metric: metric || "impressions,reach,engagement,saved,video_views" },
  });
}

// ── Instagram Hashtags ──

export async function searchInstagramHashtag(igId: string, query: string): Promise<any> {
  return request("GET", "ig_hashtag_search", {
    query: { user_id: igId, q: query },
  });
}

export async function getHashtagTopMedia(hashtagId: string, igId: string, fields?: string): Promise<any[]> {
  return paginate(`${hashtagId}/top_media`, "data", {
    user_id: igId,
    fields: fields || "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
  });
}

export async function getHashtagRecentMedia(hashtagId: string, igId: string, fields?: string): Promise<any[]> {
  return paginate(`${hashtagId}/recent_media`, "data", {
    user_id: igId,
    fields: fields || "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count",
  });
}

// ── Instagram Mentions ──

export async function getInstagramMentionedMedia(igId: string, fields?: string): Promise<any[]> {
  return paginate(`${igId}/mentioned_media`, "data", {
    fields: fields || "id,caption,media_type,media_url,permalink,timestamp",
  });
}

export async function getInstagramMentionedComments(igId: string, fields?: string): Promise<any[]> {
  return paginate(`${igId}/mentioned_comment`, "data", {
    fields: fields || "id,text,timestamp",
  });
}

// ── Instagram Messaging ──

export async function listInstagramConversations(igId: string, fields?: string): Promise<any[]> {
  return paginate(`${igId}/conversations`, "data", {
    platform: "instagram",
    fields: fields || "id,participants,updated_time,snippet,message_count",
  });
}

export async function getConversationMessages(conversationId: string, fields?: string): Promise<any[]> {
  return paginate(`${conversationId}/messages`, "data", {
    fields: fields || "id,message,from,to,created_time,attachments{mime_type,name,size,url}",
  });
}

export async function sendInstagramMessage(igId: string, recipientId: string, message: string): Promise<any> {
  return request("POST", `${igId}/messages`, {
    body: {
      recipient: { id: recipientId },
      message: { text: message },
    },
  });
}

export async function sendInstagramMediaMessage(igId: string, recipientId: string, mediaType: "image" | "video" | "audio", mediaUrl: string): Promise<any> {
  return request("POST", `${igId}/messages`, {
    body: {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: mediaType,
          payload: { url: mediaUrl },
        },
      },
    },
  });
}

// ═══════════════════════════════════════════════════════
// FACEBOOK
// ═══════════════════════════════════════════════════════

// ── Facebook Posts ──

export async function listFacebookFeed(pageId: string, fields?: string, limit?: number): Promise<any[]> {
  return paginate(`${pageId}/feed`, "data", {
    fields: fields || "id,message,story,created_time,type,permalink_url,shares,likes.summary(true),comments.summary(true),attachments",
    ...(limit ? { limit } : {}),
  });
}

export async function getFacebookPost(postId: string, fields?: string): Promise<any> {
  return request("GET", postId, {
    query: { fields: fields || "id,message,story,created_time,type,permalink_url,shares,likes.summary(true),comments.summary(true),attachments,full_picture" },
  });
}

export async function createFacebookPost(pageId: string, params: {
  message?: string;
  link?: string;
  picture?: string;
  name?: string;
  description?: string;
  scheduled_publish_time?: number; // Unix timestamp
  published?: boolean;
  targeting?: any;
}): Promise<any> {
  return request("POST", `${pageId}/feed`, { body: params });
}

export async function updateFacebookPost(postId: string, params: {
  message?: string;
}): Promise<any> {
  return request("POST", postId, { body: params });
}

export async function deleteFacebookPost(postId: string): Promise<void> {
  await request("DELETE", postId);
}

// ── Facebook Photos ──

export async function uploadFacebookPhoto(pageId: string, params: {
  url: string;
  caption?: string;
  published?: boolean;
}): Promise<any> {
  return request("POST", `${pageId}/photos`, { body: params });
}

export async function getFacebookPhoto(photoId: string, fields?: string): Promise<any> {
  return request("GET", photoId, {
    query: { fields: fields || "id,name,album,created_time,images,picture,width,height,link" },
  });
}

// ── Facebook Videos ──

export async function uploadFacebookVideo(pageId: string, params: {
  file_url: string;
  title?: string;
  description?: string;
  published?: boolean;
  scheduled_publish_time?: number;
}): Promise<any> {
  return request("POST", `${pageId}/videos`, { body: params });
}

export async function getFacebookVideo(videoId: string, fields?: string): Promise<any> {
  return request("GET", videoId, {
    query: { fields: fields || "id,title,description,created_time,length,views,permalink_url,status,picture,source" },
  });
}

// ── Facebook Albums ──

export async function listFacebookAlbums(pageId: string): Promise<any[]> {
  return paginate(`${pageId}/albums`, "data", {
    fields: "id,name,description,count,created_time,type,cover_photo{id,picture}",
  });
}

export async function createFacebookAlbum(pageId: string, name: string, description?: string): Promise<any> {
  return request("POST", `${pageId}/albums`, { body: { name, description } });
}

// ── Facebook Comments ──

export async function listFacebookComments(objectId: string, fields?: string): Promise<any[]> {
  return paginate(`${objectId}/comments`, "data", {
    fields: fields || "id,message,from,created_time,like_count,comment_count,attachment,parent",
  });
}

export async function getFacebookComment(commentId: string, fields?: string): Promise<any> {
  return request("GET", commentId, {
    query: { fields: fields || "id,message,from,created_time,like_count,comment_count,attachment,parent" },
  });
}

export async function createFacebookComment(objectId: string, message: string, attachmentUrl?: string): Promise<any> {
  const body: any = { message };
  if (attachmentUrl) body.attachment_url = attachmentUrl;
  return request("POST", `${objectId}/comments`, { body });
}

export async function deleteFacebookComment(commentId: string): Promise<void> {
  await request("DELETE", commentId);
}

export async function hideFacebookComment(commentId: string, hide: boolean = true): Promise<any> {
  return request("POST", commentId, { body: { is_hidden: hide } });
}

// ── Facebook Messenger ──

export async function listFacebookConversations(pageId: string, fields?: string): Promise<any[]> {
  return paginate(`${pageId}/conversations`, "data", {
    fields: fields || "id,participants,updated_time,snippet,message_count",
  });
}

export async function getFacebookMessages(conversationId: string, fields?: string): Promise<any[]> {
  return paginate(`${conversationId}/messages`, "data", {
    fields: fields || "id,message,from,to,created_time,attachments{mime_type,name,size,url}",
  });
}

export async function sendFacebookMessage(pageId: string, recipientId: string, message: string): Promise<any> {
  return request("POST", `${pageId}/messages`, {
    body: {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text: message },
    },
  });
}

export async function sendFacebookTemplateMessage(pageId: string, recipientId: string, template: any): Promise<any> {
  return request("POST", `${pageId}/messages`, {
    body: {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { attachment: { type: "template", payload: template } },
    },
  });
}

export async function sendFacebookMediaMessage(pageId: string, recipientId: string, mediaType: "image" | "video" | "audio" | "file", mediaUrl: string): Promise<any> {
  return request("POST", `${pageId}/messages`, {
    body: {
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: {
        attachment: { type: mediaType, payload: { url: mediaUrl, is_reusable: true } },
      },
    },
  });
}

// ── Facebook Page Insights ──

export async function getFacebookPageInsights(pageId: string, params: {
  metric: string;
  period?: string;
  since?: string;
  until?: string;
  date_preset?: string;
}): Promise<any> {
  return request("GET", `${pageId}/insights`, {
    query: {
      metric: params.metric,
      period: params.period,
      since: params.since,
      until: params.until,
      date_preset: params.date_preset,
    },
  });
}

export async function getFacebookPostInsights(postId: string, metric?: string): Promise<any> {
  return request("GET", `${postId}/insights`, {
    query: { metric: metric || "post_impressions,post_impressions_unique,post_clicks,post_engaged_users,post_reactions_by_type_total" },
  });
}

// ── Facebook Page Settings ──

export async function updateFacebookPage(pageId: string, params: {
  about?: string;
  description?: string;
  website?: string;
  phone?: string;
  emails?: string[];
}): Promise<any> {
  return request("POST", pageId, { body: params });
}

// ── Shared: User Permissions ──

export async function listPermissions(): Promise<any[]> {
  const data: any = await request("GET", "me/permissions");
  return data.data || [];
}

// ── Shared: Debug Token ──

export async function debugToken(tokenToInspect?: string): Promise<any> {
  const data: any = await request("GET", "debug_token", {
    query: { input_token: tokenToInspect || getAccessToken() },
  });
  return data.data;
}

// ═══════════════════════════════════════════════════════
// META MARKETING & ADS API
// ═══════════════════════════════════════════════════════

// ── Ad Accounts ──

export async function listAdAccounts(fields?: string): Promise<any[]> {
  return paginate("me/adaccounts", "data", {
    fields: fields || "id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,spend_cap,business_name,created_time",
  });
}

export async function getAdAccount(accountId: string, fields?: string): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("GET", id, {
    query: { fields: fields || "id,name,account_id,account_status,currency,timezone_name,amount_spent,balance,spend_cap,business_name,age,funding_source,created_time" },
  });
}

export async function updateAdAccount(accountId: string, params: {
  name?: string;
  spend_cap?: number;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", id, { body: params });
}

// ── Campaigns ──

export async function listCampaigns(accountId: string, params: {
  status?: string[];
  fields?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/campaigns`, "data", {
    fields: params.fields || "id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,created_time,updated_time,start_time,stop_time,special_ad_categories",
    ...(params.status ? { effective_status: JSON.stringify(params.status) } : {}),
    ...(params.limit ? { limit: params.limit } : {}),
  });
}

export async function getCampaign(campaignId: string, fields?: string): Promise<any> {
  return request("GET", campaignId, {
    query: { fields: fields || "id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_strategy,buying_type,created_time,updated_time,start_time,stop_time,special_ad_categories" },
  });
}

export async function createCampaign(accountId: string, params: {
  name: string;
  objective: string;
  status?: string;
  special_ad_categories?: string[];
  daily_budget?: number;
  lifetime_budget?: number;
  bid_strategy?: string;
  start_time?: string;
  stop_time?: string;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const body: any = { ...params };
  if (!body.special_ad_categories) body.special_ad_categories = [];
  return request("POST", `${id}/campaigns`, { body });
}

export async function updateCampaign(campaignId: string, params: {
  name?: string;
  status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  bid_strategy?: string;
  stop_time?: string;
}): Promise<any> {
  return request("POST", campaignId, { body: params });
}

export async function deleteCampaign(campaignId: string): Promise<void> {
  await request("DELETE", campaignId);
}

// ── Ad Sets ──

export async function listAdSets(accountId: string, params: {
  campaign_id?: string;
  status?: string[];
  fields?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/adsets`, "data", {
    fields: params.fields || "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_amount,bid_strategy,billing_event,optimization_goal,targeting,start_time,end_time,created_time,updated_time",
    ...(params.campaign_id ? { campaign_id: params.campaign_id } : {}),
    ...(params.status ? { effective_status: JSON.stringify(params.status) } : {}),
    ...(params.limit ? { limit: params.limit } : {}),
  });
}

export async function getAdSet(adsetId: string, fields?: string): Promise<any> {
  return request("GET", adsetId, {
    query: { fields: fields || "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,budget_remaining,bid_amount,bid_strategy,billing_event,optimization_goal,targeting,promoted_object,start_time,end_time,created_time,updated_time" },
  });
}

export async function createAdSet(accountId: string, params: {
  name: string;
  campaign_id: string;
  status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  bid_amount?: number;
  bid_strategy?: string;
  billing_event: string;
  optimization_goal: string;
  targeting: any;
  promoted_object?: any;
  start_time?: string;
  end_time?: string;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/adsets`, { body: params });
}

export async function updateAdSet(adsetId: string, params: {
  name?: string;
  status?: string;
  daily_budget?: number;
  lifetime_budget?: number;
  bid_amount?: number;
  targeting?: any;
  start_time?: string;
  end_time?: string;
}): Promise<any> {
  return request("POST", adsetId, { body: params });
}

export async function deleteAdSet(adsetId: string): Promise<void> {
  await request("DELETE", adsetId);
}

// ── Ads ──

export async function listAds(accountId: string, params: {
  adset_id?: string;
  campaign_id?: string;
  status?: string[];
  fields?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/ads`, "data", {
    fields: params.fields || "id,name,adset_id,campaign_id,status,effective_status,creative{id,name,thumbnail_url},created_time,updated_time",
    ...(params.adset_id ? { adset_id: params.adset_id } : {}),
    ...(params.campaign_id ? { campaign_id: params.campaign_id } : {}),
    ...(params.status ? { effective_status: JSON.stringify(params.status) } : {}),
    ...(params.limit ? { limit: params.limit } : {}),
  });
}

export async function getAd(adId: string, fields?: string): Promise<any> {
  return request("GET", adId, {
    query: { fields: fields || "id,name,adset_id,campaign_id,status,effective_status,creative{id,name,body,title,thumbnail_url,image_url,video_id,object_story_spec},created_time,updated_time,tracking_specs,conversion_specs" },
  });
}

export async function createAd(accountId: string, params: {
  name: string;
  adset_id: string;
  creative: { creative_id: string } | any;
  status?: string;
  tracking_specs?: any[];
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/ads`, { body: params });
}

export async function updateAd(adId: string, params: {
  name?: string;
  status?: string;
  creative?: any;
}): Promise<any> {
  return request("POST", adId, { body: params });
}

export async function deleteAd(adId: string): Promise<void> {
  await request("DELETE", adId);
}

export async function getAdPreview(adId: string, adFormat?: string): Promise<any> {
  return request("GET", `${adId}/previews`, {
    query: { ad_format: adFormat || "DESKTOP_FEED_STANDARD" },
  });
}

// ── Ad Creatives ──

export async function listAdCreatives(accountId: string, fields?: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/adcreatives`, "data", {
    fields: fields || "id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,status,created_time",
  });
}

export async function getAdCreative(creativeId: string, fields?: string): Promise<any> {
  return request("GET", creativeId, {
    query: { fields: fields || "id,name,title,body,image_url,thumbnail_url,video_id,object_story_spec,object_story_id,url_tags,status,created_time" },
  });
}

export async function createAdCreative(accountId: string, params: {
  name: string;
  object_story_spec?: any;
  object_story_id?: string;
  image_hash?: string;
  image_url?: string;
  video_id?: string;
  title?: string;
  body?: string;
  link_url?: string;
  url_tags?: string;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/adcreatives`, { body: params });
}

export async function deleteAdCreative(creativeId: string): Promise<void> {
  await request("DELETE", creativeId);
}

// ── Ad Images ──

export async function listAdImages(accountId: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/adimages`, "data", {
    fields: "id,hash,name,url,url_128,width,height,created_time,status",
  });
}

export async function uploadAdImage(accountId: string, imageUrl: string, name?: string): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  // Use the URL-based upload
  return request("POST", `${id}/adimages`, { body: { url: imageUrl, name } });
}

export async function deleteAdImage(accountId: string, imageHash: string): Promise<void> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  await request("DELETE", `${id}/adimages`, { body: { hash: imageHash } });
}

// ── Custom Audiences ──

export async function listCustomAudiences(accountId: string, fields?: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/customaudiences`, "data", {
    fields: fields || "id,name,description,subtype,approximate_count,delivery_status,operation_status,data_source,time_created,time_updated",
  });
}

export async function getCustomAudience(audienceId: string, fields?: string): Promise<any> {
  return request("GET", audienceId, {
    query: { fields: fields || "id,name,description,subtype,approximate_count,delivery_status,operation_status,data_source,rule,lookalike_spec,time_created,time_updated" },
  });
}

export async function createCustomAudience(accountId: string, params: {
  name: string;
  description?: string;
  subtype: string;
  rule?: any;
  lookalike_spec?: any;
  customer_file_source?: string;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/customaudiences`, { body: params });
}

export async function updateCustomAudience(audienceId: string, params: {
  name?: string;
  description?: string;
}): Promise<any> {
  return request("POST", audienceId, { body: params });
}

export async function addUsersToAudience(audienceId: string, params: {
  schema: string[];
  data: string[][];
}): Promise<any> {
  return request("POST", `${audienceId}/users`, {
    body: { payload: params },
  });
}

export async function removeUsersFromAudience(audienceId: string, params: {
  schema: string[];
  data: string[][];
}): Promise<any> {
  return request("DELETE", `${audienceId}/users`, {
    body: { payload: params },
  });
}

export async function deleteCustomAudience(audienceId: string): Promise<void> {
  await request("DELETE", audienceId);
}

// ── Saved Audiences ──

export async function listSavedAudiences(accountId: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/saved_audiences`, "data", {
    fields: "id,name,description,approximate_count,targeting,run_status,time_created,time_updated",
  });
}

// ── Ad Insights (Reporting) ──

export async function getAdAccountInsights(accountId: string, params: {
  date_preset?: string;
  time_range?: { since: string; until: string };
  fields?: string;
  breakdowns?: string;
  level?: string;
  time_increment?: string;
  filtering?: any[];
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const query: any = {
    fields: params.fields || "impressions,clicks,ctr,cpc,cpm,spend,reach,frequency,actions,cost_per_action_type,conversions,cost_per_conversion",
  };
  if (params.date_preset) query.date_preset = params.date_preset;
  if (params.time_range) query.time_range = JSON.stringify(params.time_range);
  if (params.breakdowns) query.breakdowns = params.breakdowns;
  if (params.level) query.level = params.level;
  if (params.time_increment) query.time_increment = params.time_increment;
  if (params.filtering) query.filtering = JSON.stringify(params.filtering);
  return request("GET", `${id}/insights`, { query });
}

export async function getCampaignInsights(campaignId: string, params: {
  date_preset?: string;
  time_range?: { since: string; until: string };
  fields?: string;
  breakdowns?: string;
  time_increment?: string;
}): Promise<any> {
  const query: any = {
    fields: params.fields || "campaign_name,impressions,clicks,ctr,cpc,cpm,spend,reach,frequency,actions,cost_per_action_type",
  };
  if (params.date_preset) query.date_preset = params.date_preset;
  if (params.time_range) query.time_range = JSON.stringify(params.time_range);
  if (params.breakdowns) query.breakdowns = params.breakdowns;
  if (params.time_increment) query.time_increment = params.time_increment;
  return request("GET", `${campaignId}/insights`, { query });
}

export async function getAdSetInsights(adsetId: string, params: {
  date_preset?: string;
  time_range?: { since: string; until: string };
  fields?: string;
  breakdowns?: string;
  time_increment?: string;
}): Promise<any> {
  const query: any = {
    fields: params.fields || "adset_name,impressions,clicks,ctr,cpc,cpm,spend,reach,frequency,actions,cost_per_action_type",
  };
  if (params.date_preset) query.date_preset = params.date_preset;
  if (params.time_range) query.time_range = JSON.stringify(params.time_range);
  if (params.breakdowns) query.breakdowns = params.breakdowns;
  if (params.time_increment) query.time_increment = params.time_increment;
  return request("GET", `${adsetId}/insights`, { query });
}

export async function getAdInsights(adId: string, params: {
  date_preset?: string;
  time_range?: { since: string; until: string };
  fields?: string;
  breakdowns?: string;
  time_increment?: string;
}): Promise<any> {
  const query: any = {
    fields: params.fields || "ad_name,impressions,clicks,ctr,cpc,cpm,spend,reach,frequency,actions,cost_per_action_type,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions",
  };
  if (params.date_preset) query.date_preset = params.date_preset;
  if (params.time_range) query.time_range = JSON.stringify(params.time_range);
  if (params.breakdowns) query.breakdowns = params.breakdowns;
  if (params.time_increment) query.time_increment = params.time_increment;
  return request("GET", `${adId}/insights`, { query });
}

// ── Pixels ──

export async function listPixels(accountId: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/adspixels`, "data", {
    fields: "id,name,code,creation_time,is_created_by_app,last_fired_time",
  });
}

export async function getPixel(pixelId: string, fields?: string): Promise<any> {
  return request("GET", pixelId, {
    query: { fields: fields || "id,name,code,creation_time,is_created_by_app,last_fired_time,data_use_setting,enable_automatic_matching,automatic_matching_fields" },
  });
}

export async function createPixel(accountId: string, name: string): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/adspixels`, { body: { name } });
}

// ── Product Catalogs ──

export async function listProductCatalogs(businessId: string): Promise<any[]> {
  return paginate(`${businessId}/owned_product_catalogs`, "data", {
    fields: "id,name,product_count,feed_count,vertical,created_time",
  });
}

export async function getProductCatalog(catalogId: string, fields?: string): Promise<any> {
  return request("GET", catalogId, {
    query: { fields: fields || "id,name,product_count,feed_count,vertical,created_time" },
  });
}

export async function listCatalogProducts(catalogId: string, fields?: string): Promise<any[]> {
  return paginate(`${catalogId}/products`, "data", {
    fields: fields || "id,name,description,price,currency,image_url,url,availability,brand,category,retailer_id",
  });
}

// ── Lead Gen Forms ──

export async function listLeadGenForms(pageId: string): Promise<any[]> {
  return paginate(`${pageId}/leadgen_forms`, "data", {
    fields: "id,name,status,leads_count,created_time,expired_leads_count",
  });
}

export async function getLeadGenForm(formId: string, fields?: string): Promise<any> {
  return request("GET", formId, {
    query: { fields: fields || "id,name,status,leads_count,created_time,questions,privacy_policy_url,thank_you_page_url" },
  });
}

export async function getLeads(formId: string, fields?: string): Promise<any[]> {
  return paginate(`${formId}/leads`, "data", {
    fields: fields || "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id",
  });
}

// ── Ad Rules ──

export async function listAdRules(accountId: string): Promise<any[]> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return paginate(`${id}/adrules_library`, "data", {
    fields: "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time",
  });
}

export async function getAdRule(ruleId: string, fields?: string): Promise<any> {
  return request("GET", ruleId, {
    query: { fields: fields || "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time" },
  });
}

export async function createAdRule(accountId: string, params: {
  name: string;
  evaluation_spec: any;
  execution_spec: any;
  schedule_spec?: any;
  status?: string;
}): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("POST", `${id}/adrules_library`, { body: params });
}

export async function updateAdRule(ruleId: string, params: {
  name?: string;
  status?: string;
  evaluation_spec?: any;
  execution_spec?: any;
  schedule_spec?: any;
}): Promise<any> {
  return request("POST", ruleId, { body: params });
}

export async function deleteAdRule(ruleId: string): Promise<void> {
  await request("DELETE", ruleId);
}

// ── Targeting Search ──

export async function searchTargeting(type: string, query: string, params: {
  limit?: number;
  locale?: string;
} = {}): Promise<any> {
  return request("GET", "search", {
    query: { type, q: query, limit: params.limit, locale: params.locale },
  });
}

export async function getTargetingBrowse(accountId: string, type?: string): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("GET", `${id}/targetingbrowse`, {
    query: type ? { type } : {},
  });
}

// ── Reach Estimate ──

export async function getReachEstimate(accountId: string, targetingSpec: any, optimizationGoal?: string): Promise<any> {
  const id = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  return request("GET", `${id}/reachestimate`, {
    query: {
      targeting_spec: JSON.stringify(targetingSpec),
      optimization_goal: optimizationGoal,
    },
  });
}

// ── Formatter ──

export function formatJson(data: any): string {
  return JSON.stringify(data, null, 2);
}
