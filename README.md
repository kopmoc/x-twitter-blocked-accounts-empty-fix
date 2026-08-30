# X / Twitter Blocked Accounts Empty Fix

[![简体中文](https://img.shields.io/badge/README-简体中文-1d9bf0)](README.zh-CN.md)

A read-only mitigation tool for X/Twitter **Blocked Accounts pages that are blank, incomplete, or fail to show newly blocked accounts**.

---

## What problem does this project solve?

This tool targets cases where X/Twitter's **Blocked Accounts** page is blank, incomplete, or fails to show an account you just blocked.

Common situations include:

- you manually blocked large numbers of spam, advertising, scam, or bot accounts in the past;
- you used browser extensions, scripts, or filtering tools with **automatic blocking / bulk blocking** features;
- over time, many of those historical accounts were suspended by X;
- your block history accumulated large numbers of accounts that can no longer be displayed normally.

When enough of those accounts occupy a continuous region of the list, the official UI may stop loading too early and never reach later blocked accounts.

The clearest symptom is:

> **You successfully block a normal account, its profile clearly shows that it is blocked, but it does not appear in the Blocked Accounts page.**

---

## Is cleaning up old blocked accounts required?

**No.**

Cleaning up a large historical block list can make the problem much easier to notice, but it is not required.

Even if you never clean up old blocks, the official page can still stop if it reaches a region made up of accounts that can no longer be displayed normally while more blocked accounts still exist later in the list.

So:

> **Cleanup is not the root cause; it only makes the bug easier to expose.**

---

## Why can older and newer accounts behave differently?

On affected accounts, there can be an approximate time boundary:

- newer accounts may still appear normally;
- older accounts can be successfully blocked but end up behind the empty-page region, so the official UI never reaches them.

This boundary is related to account ID / creation time, but it is **not a universal cutoff date on X**. Each user's block history is different, so the boundary can be different too.

For the detailed ordering and Snowflake analysis, see:

[`docs/bug-analysis.md`](docs/bug-analysis.md)

---

## Why can the official list become blank?

In short, X's Blocked Accounts page can stop loading when it reaches a page made up entirely of historical accounts that can no longer be displayed normally. Accounts that exist later in the blocked list then become unreachable in the official UI.

For the detailed GraphQL response shape and pagination analysis, see:

[`docs/bug-analysis.md`](docs/bug-analysis.md)

---

## What does this tool do?

The tool continues reading beyond the point where the official UI stops, skips those empty pages, and finds later blocked accounts that can still be displayed normally.

It is read-only and does not modify your block relationships.

Implementation details are documented in:

[`docs/bug-analysis.md`](docs/bug-analysis.md)

---

## Safety

This tool is deliberately **read-only**.

It does **not**:

- block accounts;
- unblock accounts;
- call `blocks/destroy`;
- change X account settings;
- upload your blocked-account list to a third-party server.

It only reads the `BlockedAccountsAll` timeline through the X session already open in your browser.

The viewer stops on:

- HTTP `429`;
- repeated cursor;
- missing next `Bottom` cursor;
- actual end of the timeline.

Default delay:

```text
300 ms
```

---

## How to run it

There are two ways to use the tool.

### Method 1: run it directly from the browser console

This is the quickest method and does not require a userscript extension.

1. Log in to X.
2. Open:

```text
https://x.com/settings/blocked/all
```

3. Press `F12` to open Developer Tools.
4. Open the **Console** tab.
5. Open `x-twitter-blocked-accounts-empty-fix.user.js` from this repository.
6. Copy the full JavaScript source.
7. Paste it into the Console.
8. Press Enter.

A floating viewer should appear on the page.

> Chrome / Chromium may show a security warning the first time you paste code into DevTools. Only run code you have inspected and trust. This repository is public specifically so the source can be reviewed before execution.

### Method 2: Tampermonkey / Violentmonkey

For repeated use:

1. Install Tampermonkey or Violentmonkey.
2. Create a new userscript.
3. Replace its contents with `x-twitter-blocked-accounts-empty-fix.user.js`.
4. Save.
5. Log in to X.
6. Open:

```text
https://x.com/settings/blocked/all
```

The viewer will load automatically.

---

## Viewer controls

The panel provides:

- **Scan 20 pages** — scan up to 20 GraphQL pages and automatically skip empty pages;
- **Scan 100 pages** — scan up to 100 GraphQL pages in one batch;
- **Stop** — stop the current scan;
- **Back to first page** — reset pagination to the first page;
- **Filter** — filter accounts already found;
- **Open** — open the profile in a new tab.

---

## Technical analysis

See:

[`docs/bug-analysis.md`](docs/bug-analysis.md)

---

## Compatibility

Tested with X Web on **2026-08-30**.

X frequently changes internal GraphQL query IDs and feature flags. A future deployment may require an update.

The script attempts to detect a recent `BlockedAccountsAll` query ID from browser resource timing. If none is available, it falls back to the query ID that was current when this version was tested.

---

## Privacy / security

Do **not** publish the following values in GitHub issues, screenshots, or support reports:

- cookies;
- `ct0`;
- `x-csrf-token`;
- `x-client-transaction-id`;
- other session-specific request headers.

This repository does not intentionally contain user-specific session credentials or captured transaction IDs.

---

## Search keywords

```text
X blocked accounts empty
X blocked accounts blank
X blocked list incomplete
Twitter blocked accounts empty
Twitter blocked accounts not showing
Twitter block list blank
X 已屏蔽账号 空白
X 黑名单 空白
Twitter 黑名单 不显示
刚拉黑的账号不在已屏蔽列表
已屏蔽账号页面不显示
```

---

## Disclaimer

This is an unofficial client-side mitigation and diagnostic tool.

It is intended to help users access blocked-account entries that the official UI may fail to reach. It is not affiliated with X Corp. and does not claim to modify or repair X's server-side data.

---

## License

MIT
