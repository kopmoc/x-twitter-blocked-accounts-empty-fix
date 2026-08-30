// ==UserScript==
// @name         X Blocked Accounts Empty-Page Viewer
// @namespace    https://github.com/kopmoc/x-twitter-blocked-accounts-empty-fix
// @version      1.0.2
// @description  Read-only mitigation for X/Twitter Blocked Accounts pages that stop on empty pagination pages.
// @license      MIT
// @match        https://x.com/settings/blocked*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * X Blocked Accounts Empty-Page Viewer
 * v1.0.2
 *
 * Purpose:
 * - Continue BlockedAccountsAll pagination across pages that contain
 *   zero visible users but still provide a valid Bottom cursor.
 *
 * Safety:
 * - Read-only.
 * - Does NOT block or unblock accounts.
 * - Does NOT call blocks/destroy.
 * - Does NOT embed user cookies, CSRF tokens, transaction IDs,
 *   account IDs, or captured cursor values.
 * - Stops on HTTP 429, repeated cursors, or the true end of the timeline.
 *
 * Default delay: 300 ms between pages.
 * Tested against X Web on 2026-08-30.
 * X may change internal GraphQL query IDs, variables, or features at any time.
 */

(async () => {
  "use strict";

  const SCRIPT_ID = "__x_block_viewer__";
  const STYLE_ID = "__x_block_viewer_style__";
  const OPERATION = "BlockedAccountsAll";
  const FALLBACK_QUERY_ID = "XDSJN_rGtdlynilYFJLYOw";
  const PAGE_SIZE = 20;
  const PAGE_DELAY_MS = 300;

  /*
   * X Web application bearer token.
   * This is the public application token shipped by X Web, not a user's
   * account/session credential. User-specific session values are read only
   * at runtime from the already logged-in x.com page and are never stored.
   */
  const X_WEB_BEARER =
    "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

  /*
   * Fallback features used only when the current page's own
   * BlockedAccountsAll request cannot be detected from Resource Timing.
   */
  const FALLBACK_FEATURES = {
    rweb_video_screen_enabled: false,
    rweb_cashtags_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: true,
    rweb_tipjar_consumption_enabled: false,
    verified_phone_label_enabled: false,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_timeline_navigation_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    rweb_cashtags_composer_attachment_enabled: true,
    responsive_web_jetfuel_frame: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    rweb_conversational_replies_downvote_enabled: false,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    content_disclosure_indicator_enabled: true,
    content_disclosure_ai_generated_indicator_enabled: true,
    responsive_web_grok_show_grok_translated_post: true,
    responsive_web_grok_analysis_button_from_backend: true,
    post_ctas_fetch_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };

  const TEXT = {
    en: {
      title: "Blocked Accounts Empty-Page Viewer",
      subtitle: "Read-only · 300 ms/page · skips empty pages",
      visibleAccounts: "visible accounts",
      graphqlPages: "GraphQL pages",
      emptyPages: "empty pages skipped",
      ready: "Ready",
      scan20: "Scan 20 pages",
      scan100: "Scan 100 pages",
      stop: "Stop",
      reset: "Back to first page",
      filterPlaceholder: "Filter loaded accounts, e.g. username",
      open: "Open",
      initial: "initial page",
      hasNext: "next page available",
      ended: "end reached",
      queryId: "Query ID",
      pageState: "Page state",
      noNext: "No next page remains.",
      readingPage: page => `Reading GraphQL page ${page}…`,
      emptyPage: page => `Page ${page}: 0 visible users; skipping automatically.`,
      foundPage: (page, found, added) =>
        `Page ${page}: found ${found} visible user(s), ${added} new.`,
      trueEnd: "Reached the actual end of the GraphQL timeline.",
      repeatedCursor: "Repeated cursor detected; stopped to prevent a loop.",
      manualStop: "Stopped.",
      batchDone: (pages, added) =>
        `Batch complete: scanned ${pages} page(s), found ${added} new visible account(s).`,
      stopping: "Stopping…",
      resetDone: "Reset to the first page.",
      started: "Ready. Click “Scan 20 pages” to start; empty pages will be skipped automatically.",
      noCt0: "Could not find the current X login session (ct0). Make sure you are logged in to x.com.",
      rateLimited: seconds =>
        seconds
          ? `GraphQL 429: rate limited. Server suggests waiting about ${seconds} seconds.`
          : "GraphQL 429: read rate limit reached.",
      httpError: status => `HTTP ${status}: request failed. See DevTools Console for details.`,
      graphQLError: "GraphQL returned an error. See DevTools Console for details.",
      invalidJson: status => `HTTP ${status}: response was not valid JSON. See DevTools Console for details.`,
      aborted: "Request cancelled.",
      queryUpdated: "Query ID updated and pagination reset.",
      invalidQueryId: "queryId must be a non-empty string.",
      langButton: "中文",
      langTitle: "切换到中文"
    },
    zh: {
      title: "已屏蔽账号空页查看器",
      subtitle: "只读 · 300ms/页 · 自动跨空页",
      visibleAccounts: "可显示账号",
      graphqlPages: "GraphQL 页",
      emptyPages: "空页跳过",
      ready: "准备就绪",
      scan20: "扫20页",
      scan100: "扫100页",
      stop: "停止",
      reset: "回到第一页",
      filterPlaceholder: "筛选已加载账号，例如 username",
      open: "打开",
      initial: "初始页",
      hasNext: "仍有下一页",
      ended: "已经到底",
      queryId: "Query ID",
      pageState: "分页状态",
      noNext: "已经没有下一页了。",
      readingPage: page => `正在读取第 ${page} 个 GraphQL 页面……`,
      emptyPage: page => `第 ${page} 页：0 个可显示用户，自动跨过。`,
      foundPage: (page, found, added) =>
        `第 ${page} 页：找到 ${found} 个可显示用户，新增 ${added} 个。`,
      trueEnd: "已经到达 GraphQL timeline 的真实底部。",
      repeatedCursor: "检测到重复 cursor，已停止，防止死循环。",
      manualStop: "已停止。",
      batchDone: (pages, added) =>
        `本轮完成：扫描 ${pages} 页，找到 ${added} 个新的可显示账号。`,
      stopping: "正在停止……",
      resetDone: "已回到第一页。",
      started: "已启动。点“扫20页”开始；遇到空页会自动跳过。",
      noCt0: "找不到当前 X 登录会话的 ct0。请确认已经登录 x.com。",
      rateLimited: seconds =>
        seconds
          ? `GraphQL 429：触发读取限流，服务器建议约 ${seconds} 秒后再试。`
          : "GraphQL 429：触发读取限流。",
      httpError: status => `HTTP ${status}：请求失败，详细信息见 DevTools Console。`,
      graphQLError: "GraphQL 返回错误，详细信息见 DevTools Console。",
      invalidJson: status => `HTTP ${status}：返回不是有效 JSON，详细信息见 DevTools Console。`,
      aborted: "请求已取消。",
      queryUpdated: "Query ID 已更新，并已重置分页。",
      invalidQueryId: "queryId 必须是非空字符串。",
      langButton: "EN",
      langTitle: "Switch to English"
    }
  };

  function detectInitialLanguage() {
    const lang = String(document.documentElement.lang || navigator.language || "").toLowerCase();
    return lang.startsWith("zh") ? "zh" : "en";
  }

  let language = detectInitialLanguage();
  const t = () => TEXT[language];

  try {
    document.getElementById(SCRIPT_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
  } catch {}

  function safeParseJSON(value, fallback) {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function findCurrentBlockedAccountsRequest() {
    try {
      const resources = performance.getEntriesByType("resource");

      for (let i = resources.length - 1; i >= 0; i--) {
        const name = String(resources[i]?.name || "");
        if (!name.includes(`/${OPERATION}`)) continue;

        const url = new URL(name);
        const match = url.pathname.match(
          /\/i\/api\/graphql\/([^/]+)\/BlockedAccountsAll$/
        );

        if (!match?.[1]) continue;

        const variables = safeParseJSON(
          url.searchParams.get("variables") || "{}",
          {}
        );

        delete variables.cursor;
        variables.count = PAGE_SIZE;
        variables.includePromotedContent = false;

        return {
          queryId: decodeURIComponent(match[1]),
          templateUrl: url,
          baseVariables: variables
        };
      }
    } catch (error) {
      console.warn("[XBlockViewer] Could not inspect Resource Timing:", error);
    }

    return null;
  }

  const detectedRequest = findCurrentBlockedAccountsRequest();

  const STATE = {
    queryId: detectedRequest?.queryId || FALLBACK_QUERY_ID,
    templateUrl: detectedRequest?.templateUrl || null,
    baseVariables: detectedRequest?.baseVariables || {
      count: PAGE_SIZE,
      includePromotedContent: false
    },
    cursor: null,
    pages: 0,
    emptyPages: 0,
    users: new Map(),
    seenCursors: new Set(),
    running: false,
    stopRequested: false,
    ended: false,
    generation: 0,
    controller: null,
    lastStatus: ""
  };

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find(item => item.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }

  function buildRequestURL(cursor) {
    let url;

    if (STATE.templateUrl) {
      url = new URL(STATE.templateUrl.toString());
    } else {
      url = new URL(
        `https://x.com/i/api/graphql/${STATE.queryId}/${OPERATION}`
      );
      url.searchParams.set("features", JSON.stringify(FALLBACK_FEATURES));
    }

    url.pathname = `/i/api/graphql/${encodeURIComponent(STATE.queryId)}/${OPERATION}`;

    const variables = {
      ...STATE.baseVariables,
      count: PAGE_SIZE,
      includePromotedContent: false
    };

    if (cursor) variables.cursor = cursor;
    else delete variables.cursor;

    url.searchParams.set("variables", JSON.stringify(variables));

    if (!url.searchParams.has("features")) {
      url.searchParams.set("features", JSON.stringify(FALLBACK_FEATURES));
    }

    return url.toString();
  }

  function getTimelineInstructions(root) {
    const direct = root?.data?.viewer?.timeline?.timeline?.instructions;
    if (Array.isArray(direct)) return direct;

    const seen = new WeakSet();
    let found = null;

    function walk(value) {
      if (found || !value || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);

      if (
        Array.isArray(value.instructions) &&
        value.instructions.some(item =>
          typeof item?.type === "string" && item.type.startsWith("Timeline")
        )
      ) {
        found = value.instructions;
        return;
      }

      if (Array.isArray(value)) {
        for (const item of value) walk(item);
      } else {
        for (const item of Object.values(value)) walk(item);
      }
    }

    walk(root);
    return found || [];
  }

  function collectTimelineEntries(instructions) {
    const entries = [];

    for (const instruction of instructions) {
      if (Array.isArray(instruction?.entries)) {
        entries.push(...instruction.entries);
      }
      if (instruction?.entry && typeof instruction.entry === "object") {
        entries.push(instruction.entry);
      }
    }

    return entries;
  }

  function normalizeUser(candidate) {
    if (!candidate || typeof candidate !== "object") return null;

    if (
      candidate.__typename === "UserWithVisibilityResults" &&
      candidate.user
    ) {
      candidate = candidate.user;
    }

    const username =
      candidate?.legacy?.screen_name ??
      candidate?.core?.screen_name ??
      candidate?.screen_name ??
      "";

    const id =
      candidate?.rest_id ??
      candidate?.legacy?.id_str ??
      candidate?.id_str ??
      "";

    if (!username || !id) return null;

    const typename = String(candidate?.__typename || "");
    if (typename && typename !== "User") return null;

    return {
      id: String(id),
      username: String(username),
      name: String(
        candidate?.legacy?.name ??
        candidate?.core?.name ??
        candidate?.name ??
        ""
      ),
      description: String(candidate?.legacy?.description ?? "")
    };
  }

  function extractUsersFromEntry(entry) {
    const users = new Map();
    const seen = new WeakSet();

    function walk(value) {
      if (!value || typeof value !== "object") return;
      if (seen.has(value)) return;
      seen.add(value);

      const user = normalizeUser(value);
      if (user) users.set(user.id, user);

      if (Array.isArray(value)) {
        for (const item of value) walk(item);
      } else {
        for (const item of Object.values(value)) walk(item);
      }
    }

    walk(entry?.content ?? entry);
    return [...users.values()];
  }

  function parsePage(root) {
    const instructions = getTimelineInstructions(root);
    const entries = collectTimelineEntries(instructions);
    const users = new Map();
    let bottomCursor = null;
    let terminateBottom = false;

    for (const instruction of instructions) {
      if (
        instruction?.type === "TimelineTerminateTimeline" &&
        instruction?.direction === "Bottom"
      ) {
        terminateBottom = true;
      }
    }

    for (const entry of entries) {
      const content = entry?.content;

      if (
        content?.cursorType === "Bottom" &&
        typeof content?.value === "string"
      ) {
        bottomCursor = content.value;
        continue;
      }

      for (const user of extractUsersFromEntry(entry)) {
        users.set(user.id, user);
      }
    }

    return {
      users: [...users.values()],
      bottomCursor,
      terminateBottom
    };
  }

  async function requestPage(cursor, signal) {
    const ct0 = getCookie("ct0");
    if (!ct0) throw new Error(t().noCt0);

    const response = await fetch(buildRequestURL(cursor), {
      method: "GET",
      credentials: "include",
      signal,
      headers: {
        accept: "*/*",
        authorization: X_WEB_BEARER,
        "content-type": "application/json",
        "x-csrf-token": decodeURIComponent(ct0),
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "x-twitter-client-language":
          (document.documentElement.lang || navigator.language || "en").toLowerCase()
      }
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("retry-after");
      const error = new Error(t().rateLimited(retryAfter));
      error.code = "RATE_LIMIT";
      throw error;
    }

    const raw = await response.text();
    let json;

    try {
      json = JSON.parse(raw);
    } catch (error) {
      console.error("[XBlockViewer] Invalid JSON response:", {
        status: response.status,
        bodyPreview: raw.slice(0, 1000),
        error
      });
      throw new Error(t().invalidJson(response.status));
    }

    if (!response.ok) {
      console.error("[XBlockViewer] HTTP error:", {
        status: response.status,
        response: json
      });
      throw new Error(t().httpError(response.status));
    }

    if (Array.isArray(json.errors) && json.errors.length) {
      console.error("[XBlockViewer] GraphQL errors:", json.errors);
      throw new Error(t().graphQLError);
    }

    return parsePage(json);
  }

  const box = document.createElement("div");
  box.id = SCRIPT_ID;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${SCRIPT_ID} {
      position: fixed;
      z-index: 2147483647;
      right: 16px;
      top: 16px;
      width: min(470px, calc(100vw - 32px));
      height: calc(100vh - 32px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #000;
      color: #e7e9ea;
      border: 1px solid #536471;
      border-radius: 16px;
      box-shadow: 0 8px 30px rgba(0,0,0,.5);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #${SCRIPT_ID} * { box-sizing: border-box; }

    #${SCRIPT_ID} .xbv-head {
      flex: 0 0 66px;
      height: 66px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid #2f3336;
      overflow: hidden;
    }

    #${SCRIPT_ID} .xbv-head > div:first-child {
      min-width: 0;
      flex: 1 1 auto;
    }

    #${SCRIPT_ID} .xbv-head-actions {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    #${SCRIPT_ID} .xbv-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 22px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${SCRIPT_ID} .xbv-sub {
      color: #71767b;
      font-size: 12px;
      line-height: 16px;
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${SCRIPT_ID} .xbv-icon-btn {
      border: 1px solid #536471;
      border-radius: 999px;
      background: transparent;
      color: #e7e9ea;
      min-width: 34px;
      height: 34px;
      padding: 0 9px;
      cursor: pointer;
    }

    #${SCRIPT_ID} #xbv-close {
      border: 0;
      font-size: 27px;
      line-height: 1;
      padding: 0;
    }

    #${SCRIPT_ID} .xbv-stats {
      flex: 0 0 58px;
      height: 58px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      align-items: center;
      border-bottom: 1px solid #2f3336;
      overflow: hidden;
    }

    #${SCRIPT_ID} .xbv-stats > div {
      min-width: 0;
      padding: 7px 6px;
      text-align: center;
      overflow: hidden;
    }

    #${SCRIPT_ID} .xbv-stats b {
      display: block;
      font-size: 17px;
      line-height: 20px;
    }

    #${SCRIPT_ID} .xbv-stats span {
      display: block;
      color: #71767b;
      font-size: 11px;
      line-height: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${SCRIPT_ID} .xbv-status {
      flex: 0 0 34px;
      height: 34px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      color: #8ecdf8;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 1px solid #2f3336;
    }

    #${SCRIPT_ID} .xbv-actions {
      flex: 0 0 52px;
      height: 52px;
      display: grid;
      grid-template-columns: 1fr 1fr .62fr 1.05fr;
      align-items: center;
      gap: 6px;
      padding: 8px;
      overflow: hidden;
    }

    #${SCRIPT_ID} .xbv-actions button {
      width: 100%;
      min-width: 0;
      height: 36px;
      min-height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      white-space: nowrap;
      line-height: 1;
      border: 1px solid #536471;
      border-radius: 999px;
      background: #16181c;
      color: #e7e9ea;
      padding: 0 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
    }

    #${SCRIPT_ID} button:hover:not(:disabled) { background: #202327; }
    #${SCRIPT_ID} button:disabled { opacity: .45; cursor: default; }

    #${SCRIPT_ID} .xbv-search {
      flex: 0 0 44px;
      height: 44px;
      padding: 0 8px 8px;
      overflow: hidden;
    }

    #${SCRIPT_ID} .xbv-search input {
      width: 100%;
      height: 36px;
      border: 1px solid #536471;
      border-radius: 999px;
      background: #16181c;
      color: #e7e9ea;
      padding: 0 12px;
      outline: none;
    }

    #${SCRIPT_ID} .xbv-list {
      flex: 1;
      overflow-y: auto;
      border-top: 1px solid #2f3336;
    }

    #${SCRIPT_ID} .xbv-user {
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #2f3336;
    }

    #${SCRIPT_ID} .xbv-user-main { min-width: 0; flex: 1; }

    #${SCRIPT_ID} .xbv-name {
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #${SCRIPT_ID} .xbv-handle { color: #71767b; font-size: 13px; }
    #${SCRIPT_ID} .xbv-id { color: #536471; font-size: 10px; margin-top: 2px; }

    #${SCRIPT_ID} .xbv-open {
      margin-left: 8px;
      border: 1px solid #536471;
      border-radius: 999px;
      background: transparent;
      color: #e7e9ea;
      padding: 5px 10px;
      text-decoration: none;
      font-size: 12px;
    }

    #${SCRIPT_ID} .xbv-foot {
      flex: 0 0 40px;
      height: 40px;
      padding: 6px 10px;
      border-top: 1px solid #2f3336;
      color: #71767b;
      font-size: 10px;
      line-height: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  box.innerHTML = `
    <div class="xbv-head">
      <div>
        <div id="xbv-title" class="xbv-title"></div>
        <div id="xbv-sub" class="xbv-sub"></div>
      </div>
      <div class="xbv-head-actions">
        <button id="xbv-lang" class="xbv-icon-btn"></button>
        <button id="xbv-close" class="xbv-icon-btn" title="Close">×</button>
      </div>
    </div>

    <div class="xbv-stats">
      <div><b id="xbv-users">0</b><span id="xbv-users-label"></span></div>
      <div><b id="xbv-pages">0</b><span id="xbv-pages-label"></span></div>
      <div><b id="xbv-empty">0</b><span id="xbv-empty-label"></span></div>
    </div>

    <div id="xbv-status" class="xbv-status"></div>

    <div class="xbv-actions">
      <button id="xbv-scan20"></button>
      <button id="xbv-scan100"></button>
      <button id="xbv-stop"></button>
      <button id="xbv-reset"></button>
    </div>

    <div class="xbv-search">
      <input id="xbv-filter">
    </div>

    <div id="xbv-list" class="xbv-list"></div>

    <div class="xbv-foot">
      <span id="xbv-query-label"></span>：<span id="xbv-query"></span><br>
      <span id="xbv-page-state-label"></span>：<span id="xbv-page-state"></span>
    </div>
  `;

  document.head.appendChild(style);
  document.body.appendChild(box);

  const $ = id => document.getElementById(id);
  const listEl = $("xbv-list");

  function setStatus(message) {
    STATE.lastStatus = String(message || "");
    $("xbv-status").textContent = STATE.lastStatus;
  }

  function getPublicPageState() {
    if (STATE.ended) return t().ended;
    if (STATE.cursor) return t().hasNext;
    return t().initial;
  }

  function updateControls() {
    const busy = STATE.running;
    $("xbv-scan20").disabled = busy || STATE.ended;
    $("xbv-scan100").disabled = busy || STATE.ended;
    $("xbv-stop").disabled = !busy;
  }

  function applyLanguage({ preserveStatus = true } = {}) {
    const strings = t();

    $("xbv-title").textContent = strings.title;
    $("xbv-sub").textContent = strings.subtitle;
    $("xbv-users-label").textContent = strings.visibleAccounts;
    $("xbv-pages-label").textContent = strings.graphqlPages;
    $("xbv-empty-label").textContent = strings.emptyPages;
    $("xbv-scan20").textContent = strings.scan20;
    $("xbv-scan100").textContent = strings.scan100;
    $("xbv-stop").textContent = strings.stop;
    $("xbv-reset").textContent = strings.reset;
    $("xbv-filter").placeholder = strings.filterPlaceholder;
    $("xbv-query-label").textContent = strings.queryId;
    $("xbv-page-state-label").textContent = strings.pageState;
    $("xbv-lang").textContent = strings.langButton;
    $("xbv-lang").title = strings.langTitle;
    $("xbv-close").title = language === "zh" ? "关闭" : "Close";

    if (!preserveStatus || !STATE.lastStatus) {
      setStatus(strings.ready);
    }

    render();
  }

  function render() {
    const filter = $("xbv-filter")
      .value
      .trim()
      .toLowerCase()
      .replace(/^@/, "");

    listEl.innerHTML = "";

    for (const user of STATE.users.values()) {
      if (
        filter &&
        !user.username.toLowerCase().includes(filter) &&
        !user.name.toLowerCase().includes(filter)
      ) {
        continue;
      }

      const row = document.createElement("div");
      row.className = "xbv-user";

      const main = document.createElement("div");
      main.className = "xbv-user-main";

      const name = document.createElement("div");
      name.className = "xbv-name";
      name.textContent = user.name || user.username;

      const handle = document.createElement("div");
      handle.className = "xbv-handle";
      handle.textContent = `@${user.username}`;

      const id = document.createElement("div");
      id.className = "xbv-id";
      id.textContent = user.id ? `ID ${user.id}` : "";

      main.append(name, handle, id);

      const open = document.createElement("a");
      open.className = "xbv-open";
      open.textContent = t().open;
      open.href = `https://x.com/${encodeURIComponent(user.username)}`;
      open.target = "_blank";
      open.rel = "noopener noreferrer";

      row.append(main, open);
      listEl.appendChild(row);
    }

    $("xbv-users").textContent = STATE.users.size;
    $("xbv-pages").textContent = STATE.pages;
    $("xbv-empty").textContent = STATE.emptyPages;
    $("xbv-query").textContent = STATE.queryId;
    $("xbv-page-state").textContent = getPublicPageState();

    updateControls();
  }

  function cancelCurrentRun() {
    STATE.stopRequested = true;
    STATE.generation++;

    if (STATE.controller) {
      try {
        STATE.controller.abort();
      } catch {}
    }

    STATE.controller = null;
  }

  function resetState({ status = true } = {}) {
    cancelCurrentRun();

    STATE.cursor = null;
    STATE.pages = 0;
    STATE.emptyPages = 0;
    STATE.users.clear();
    STATE.seenCursors.clear();
    STATE.running = false;
    STATE.stopRequested = false;
    STATE.ended = false;
    STATE.controller = null;

    render();
    if (status) setStatus(t().resetDone);
  }

  async function scanPages(pageLimit) {
    if (STATE.running) return;

    if (STATE.ended) {
      setStatus(t().noNext);
      return;
    }

    STATE.running = true;
    STATE.stopRequested = false;

    const myGeneration = ++STATE.generation;
    const startVisible = STATE.users.size;
    let batchPages = 0;

    updateControls();

    try {
      while (
        !STATE.stopRequested &&
        !STATE.ended &&
        batchPages < pageLimit
      ) {
        setStatus(t().readingPage(STATE.pages + 1));

        const controller = new AbortController();
        STATE.controller = controller;

        const parsed = await requestPage(STATE.cursor, controller.signal);

        if (myGeneration !== STATE.generation) return;

        STATE.controller = null;
        STATE.pages++;
        batchPages++;

        let added = 0;

        for (const user of parsed.users) {
          if (!STATE.users.has(user.id)) {
            STATE.users.set(user.id, user);
            added++;
          }
        }

        if (parsed.users.length === 0) {
          STATE.emptyPages++;
          setStatus(t().emptyPage(STATE.pages));
        } else {
          setStatus(t().foundPage(STATE.pages, parsed.users.length, added));
        }

        const next = parsed.bottomCursor;

        if (parsed.terminateBottom || !next) {
          STATE.ended = true;
          STATE.cursor = null;
          render();
          setStatus(t().trueEnd);
          break;
        }

        if (next === STATE.cursor || STATE.seenCursors.has(next)) {
          STATE.ended = true;
          STATE.cursor = null;
          render();
          setStatus(t().repeatedCursor);
          break;
        }

        STATE.seenCursors.add(next);
        STATE.cursor = next;
        render();

        if (batchPages < pageLimit) {
          await sleep(PAGE_DELAY_MS);
        }

        if (myGeneration !== STATE.generation) return;
      }

      if (myGeneration !== STATE.generation) return;

      const addedThisBatch = STATE.users.size - startVisible;

      if (STATE.stopRequested) {
        setStatus(t().manualStop);
      } else if (!STATE.ended) {
        setStatus(t().batchDone(batchPages, addedThisBatch));
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        if (myGeneration === STATE.generation) setStatus(t().aborted);
      } else {
        console.error("[XBlockViewer] Stopped:", error);
        if (myGeneration === STATE.generation) {
          setStatus(error?.message || String(error));
        }
      }
    } finally {
      if (myGeneration === STATE.generation) {
        STATE.controller = null;
        STATE.running = false;
        render();
      }
    }
  }

  $("xbv-scan20").onclick = () => scanPages(20);
  $("xbv-scan100").onclick = () => scanPages(100);

  $("xbv-stop").onclick = () => {
    if (!STATE.running) return;
    setStatus(t().stopping);
    cancelCurrentRun();
    STATE.running = false;
    STATE.stopRequested = false;
    render();
    setStatus(t().manualStop);
  };

  $("xbv-reset").onclick = () => resetState();

  $("xbv-close").onclick = () => {
    cancelCurrentRun();
    box.remove();
    style.remove();
    delete window.XBlockViewer;
  };

  $("xbv-lang").onclick = () => {
    language = language === "zh" ? "en" : "zh";
    STATE.lastStatus = "";
    applyLanguage({ preserveStatus: false });
  };

  $("xbv-filter").oninput = render;

  window.XBlockViewer = Object.freeze({
    scan20() {
      return scanPages(20);
    },

    scan100() {
      return scanPages(100);
    },


    stop() {
      if (!STATE.running) return;
      $("xbv-stop").click();
    },

    reset() {
      resetState();
    },

    users() {
      return [...STATE.users.values()].map(user => ({ ...user }));
    },

    find(username) {
      const needle = String(username || "")
        .replace(/^@/, "")
        .toLowerCase();

      const user = [...STATE.users.values()].find(
        item => item.username.toLowerCase() === needle
      );

      return user ? { ...user } : null;
    },

    status() {
      return {
        running: STATE.running,
        ended: STATE.ended,
        pages: STATE.pages,
        emptyPages: STATE.emptyPages,
        visibleAccounts: STATE.users.size,
        hasNextPage: Boolean(STATE.cursor) && !STATE.ended,
        queryId: STATE.queryId,
        pageDelayMs: PAGE_DELAY_MS
      };
    },

    setQueryId(queryId) {
      if (!queryId || typeof queryId !== "string") {
        throw new Error(t().invalidQueryId);
      }

      const clean = queryId.trim();
      if (!clean) throw new Error(t().invalidQueryId);

      resetState({ status: false });
      STATE.queryId = clean;
      STATE.templateUrl = null;
      STATE.baseVariables = {
        count: PAGE_SIZE,
        includePromotedContent: false
      };
      render();
      setStatus(t().queryUpdated);
    }
  });

  applyLanguage({ preserveStatus: false });
  setStatus(t().started);
  render();

  console.log("✅ XBlockViewer installed / 已安装");
  console.log("Read-only: no block/unblock actions are performed / 只读：不会执行拉黑或解除屏蔽");
})();
