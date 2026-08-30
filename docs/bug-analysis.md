# Technical Analysis: X / Twitter Blocked Accounts Empty-Page Pagination

[![简体中文](https://img.shields.io/badge/Analysis-简体中文-1d9bf0)](bug-analysis.zh-CN.md)

## Summary

X Web's **Blocked Accounts** page can become blank or incomplete even though blocked relationships still exist and later blocked accounts are still reachable through pagination.

The key failure mode is:

```text
a page still has underlying blocked relationships
        ↓
none of the accounts on that page can be rendered as visible users
        ↓
BlockedAccountsAll returns:
0 visible users
+
a valid Bottom cursor
        ↓
the official UI stops instead of continuing
        ↓
all later blocked accounts become unreachable in the UI
```

The problem is therefore not necessarily that the block relationships are missing. The client can stop on an **empty but non-terminal page**.

---

## Typical account history that can expose the issue

Affected users may have one or more of the following:

- a long history of manually blocking spam, advertising, scam, or bot accounts;
- use of browser extensions, scripts, or filtering tools with automatic-blocking or bulk-blocking features;
- many historically blocked accounts that were later suspended by X;
- a large blocked-account collection whose visible and non-visible accounts are unevenly distributed.

Cleaning up historical blocks is **not required** for the bug to occur.

However, cleanup can make the problem easier to expose because removing many still-visible blocked accounts can leave suspended or otherwise non-renderable relationships concentrated together.

---

## Observed difference between older and newer accounts

During reproduction, a newly blocked **newer** account could appear in the official Blocked Accounts UI, while a newly blocked **older** account could be successfully blocked but remain invisible in the official list.

This suggests that the blocked-account collection is not ordered simply by the time at which the user clicked **Block**.

The observed behavior is consistent with ordering that is strongly influenced by account ID / Snowflake values.

Because X Snowflake IDs correlate with account creation time, an affected collection can show an approximate boundary:

```text
newer account
→ sorts before the long region of non-renderable historical accounts
→ still visible in the official UI

older account
→ sorts behind that region
→ official UI encounters an empty page first
→ pagination stops before reaching the account
```

This is **not a universal cutoff date**.

The apparent boundary depends on the individual user's blocked-account data, including:

- the ID distribution of historical blocked accounts;
- which of those accounts are suspended or otherwise non-renderable;
- page boundaries;
- X's current server-side ordering and filtering behavior.

---

## GraphQL operation

The X Web page uses the GraphQL operation:

```text
BlockedAccountsAll
```

A reproduced request used a generated query ID of the form:

```text
/i/api/graphql/<query-id>/BlockedAccountsAll
```

The query ID is deployment-specific and can change after X updates its Web frontend.

---

## Reproduced response shape

A reproduced initial response contained timeline instructions equivalent to:

```json
{
  "type": "TimelineClearCache"
}
```

followed by:

```json
{
  "direction": "Top",
  "type": "TimelineTerminateTimeline"
}
```

and then:

```json
{
  "type": "TimelineAddEntries",
  "entries": [
    {
      "content": {
        "__typename": "TimelineTimelineCursor",
        "cursorType": "Bottom",
        "entryType": "TimelineTimelineCursor",
        "value": "<redacted>|..."
      }
    },
    {
      "content": {
        "__typename": "TimelineTimelineCursor",
        "cursorType": "Top",
        "entryType": "TimelineTimelineCursor",
        "value": "-1|..."
      }
    }
  ]
}
```

The important point is that this page contained:

```text
0 visible User entries
+
a valid Bottom cursor
```

The `TimelineTerminateTimeline` instruction shown above was for:

```text
direction: Top
```

It therefore did not mean that the bottom direction had ended.

A valid `Bottom` cursor still existed.

---

## Cross-check with REST blocked-account pagination

During diagnosis, the corresponding REST endpoints still returned blocked relationships and a next cursor.

The first REST page and the GraphQL response had the same underlying next-cursor prefix:

```text
<redacted>
```

This supports the conclusion that the GraphQL page was not at the true end of the blocked relationship collection.

Even though that GraphQL page contained no visible users, the server still provided a continuation point.

---

## Why suspended accounts matter

A blocked relationship can continue to exist even when the target account is suspended.

In the observed dataset, many historical blocked accounts returned suspension-related status when checked through account lookup, while the underlying blocked relationships were still present.

Those accounts can therefore occupy positions in the blocked-account collection even though they are not rendered as normal visible users in the GraphQL timeline.

If enough such accounts fill an entire page, the client can receive:

```text
0 renderable users
+
valid next cursor
```

That is the exact edge case that exposes the pagination problem.

Suspension is not the only theoretically possible reason for an account to become non-renderable, but it was the dominant observed case during diagnosis.

---

## Why cleanup is not the root cause

It is tempting to conclude that cleaning up old blocks causes the problem, because the issue can become obvious after cleanup.

That interpretation is too strong.

The more accurate model is:

```text
cleanup removes many visible blocked accounts
        ↓
non-renderable historical relationships become more concentrated
        ↓
an all-empty page becomes more likely to appear near the front
        ↓
the existing pagination bug becomes visible
```

So cleanup is an **exposure factor**, not the underlying bug.

An account that never performs cleanup can still encounter the same failure later in the list if it reaches an empty-but-nonterminal page.

---

## Why a single visible "anchor" account does not fully fix the UI

Blocking one newer visible account can make the first page non-empty again.

That may make the official Blocked Accounts page appear to recover temporarily.

However, it does not solve the underlying pagination problem.

A particularly important case is this:

```text
a newer visible blocked account exists near the front
        ↓
the first page is no longer empty
        ↓
you then block an older account
        ↓
that older account sorts behind the empty-page region
        ↓
the official UI still stops before reaching it
```

So even while an "anchor" account is visible, a newly blocked older account can still fail to appear in the official list.

If later pagination reaches another page containing zero renderable users while a valid Bottom cursor still exists, the UI can stop again.

Therefore:

```text
one visible account near the front
≠
full repair of the official blocked list
```

The anchor only makes the front of the list visible again; it does not restore reliable traversal across later empty pages.

---

## Correct pagination behavior

The client should not use the number of rendered user cards as the only terminal condition.

A safer rule is:

```text
if visibleUsers.length === 0
and Bottom cursor exists
and Bottom cursor is new
and the bottom direction has not terminated
then continue pagination
```

Pagination should stop only when one of the following is true:

- the bottom direction is explicitly terminated;
- no `Bottom` cursor is returned;
- the cursor repeats;
- a bounded safety limit is reached;
- the request fails or is rate-limited.

This treats cursor state as the source of truth rather than assuming that an empty rendered page means the collection has ended.

---

## What the mitigation tool does

The userscript in this repository applies that pagination rule on the client side.

It:

- reads `BlockedAccountsAll`;
- follows valid `Bottom` cursors;
- skips pages that contain zero visible users;
- stops on HTTP `429`;
- stops on repeated cursors;
- stops when the timeline really ends.

It does **not**:

- block accounts;
- unblock accounts;
- call `blocks/destroy`;
- modify the user's blocked-account relationships.

The tool mitigates the display/pagination failure. It does not repair X's server-side implementation.

---

## Query ID changes

X GraphQL query IDs are generated and can change between frontend deployments.

The script therefore:

1. attempts to detect a recent `BlockedAccountsAll` query ID from browser resource timing;
2. falls back to the query ID that was current when the tool was tested.

If X changes the operation structure, feature flags, or query ID format, the script may require an update.

---

## Rate limiting

The viewer uses read-only GraphQL requests.

It currently waits:

```text
300 ms
```

between pages.

Read endpoints can still be rate-limited.

The script therefore stops immediately on:

```text
HTTP 429
```

and does not repeatedly retry the request.

The number of pages required can vary greatly between accounts, especially for users with very large historical block lists or long-term use of automatic/bulk-blocking tools.

---

## Privacy and security

No public bug report or GitHub issue should include:

- cookies;
- `ct0`;
- `x-csrf-token`;
- `x-client-transaction-id`;
- other session-specific request headers.

The public userscript should not embed user-specific session credentials or captured transaction IDs.

The tool reads the current X session locally in the browser.

---

## Suggested product fix

The product-level fix is small in concept:

> An empty rendered page should not terminate blocked-account pagination while a valid, non-repeating `Bottom` cursor still exists.

The official client should continue until the bottom direction actually terminates or no continuation cursor remains.

---

## Scope

This analysis describes a **product correctness / pagination issue**, not a security vulnerability.

The main impact is that users can be unable to review blocked accounts through the official Web/App UI even though the underlying block relationships still exist.

---

## Tested

Reproduced on X Web on **2026-08-30**.
