# 技术分析：X / Twitter「已屏蔽账号」空页分页问题

[![English](https://img.shields.io/badge/Analysis-English-1d9bf0)](bug-analysis.md)

## 摘要

X Web 的「已屏蔽账号」页面可能出现空白或显示不完整，即使底层仍然存在 block relationships，而且后面的已屏蔽账号实际上仍然可以通过继续分页访问。

关键故障模式是：

```text
某一页底层仍然存在 blocked relationships
        ↓
这一页中的账号全部无法渲染成可见用户
        ↓
BlockedAccountsAll 返回：
0 个可显示用户
+
有效的 Bottom cursor
        ↓
官方 UI 没有继续请求下一页
        ↓
后面的所有已屏蔽账号在官方界面中都变得不可达
```

因此，问题不一定是 block relationship 消失，而是客户端可能停在了一个**空白但并未真正结束的分页**。

---

## 哪些历史使用情况更容易暴露这个问题？

受影响的用户可能具有以下一种或多种情况：

- 长期手动拉黑大量广告号、垃圾账号、诈骗号或 bot；
- 使用过带有自动拉黑或批量拉黑功能的浏览器插件、脚本或过滤工具；
- 大量过去被拉黑的账号后来被 X 官方封禁；
- 历史黑名单规模很大，而可显示与不可显示账号在列表中的分布很不均匀。

清理历史拉黑账号**不是**这个 Bug 发生的必要条件。

但清理会让问题更容易暴露，因为移除大量仍然可显示的账号后，被封禁或其他无法渲染的历史关系可能会更加集中。

---

## 为什么较老和较新的账号可能表现不同？

在实际复现中，新拉黑的**较新账号**可以出现在官方「已屏蔽账号」页面，而新拉黑的**较老账号**虽然已经成功被屏蔽，却不会出现在官方列表里。

这说明底层 blocked-account collection 并不是简单按照“用户什么时候点击了拉黑”排序。

当前观察更符合：排序在很大程度上受到账号 ID / Snowflake 值影响。

由于 X Snowflake ID 与账号创建时间高度相关，在受影响的 collection 中可能出现一个近似分界：

```text
较新的账号
→ 排在大量不可渲染历史账号之前
→ 官方 UI 仍然可以看到

较老的账号
→ 排在这些历史账号之后
→ 官方 UI 先遇到空页
→ 分页停止，无法到达这个账号
```

这**不是一个 X 全局统一的固定日期**。

实际分界取决于每个用户自己的历史黑名单数据，包括：

- 历史被屏蔽账号的 ID 分布；
- 哪些账号已经 suspended 或因为其他原因无法正常渲染；
- 分页切分位置；
- X 当前服务端的排序和过滤行为。

---

## GraphQL operation

X Web 的页面使用：

```text
BlockedAccountsAll
```

这一 GraphQL operation。

实际请求路径形式类似：

```text
/i/api/graphql/<query-id>/BlockedAccountsAll
```

其中 query ID 与当前 Web 前端部署有关，X 更新前端后可能发生变化。

---

## 实际复现到的响应结构

一次复现中的初始响应包含了类似下面的 timeline instructions：

```json
{
  "type": "TimelineClearCache"
}
```

随后是：

```json
{
  "direction": "Top",
  "type": "TimelineTerminateTimeline"
}
```

然后：

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

关键点是，这一页包含：

```text
0 个可显示 User entries
+
有效的 Bottom cursor
```

上面的 `TimelineTerminateTimeline` 指令是：

```text
direction: Top
```

因此它并不意味着 Bottom 方向已经结束。

实际上仍然存在有效的 `Bottom` cursor。

---

## 与 REST 黑名单分页的交叉验证

诊断过程中，对应的 REST endpoints 仍然能够返回 blocked relationships 以及 next cursor。

第一批 REST 数据和 GraphQL 响应中的下一页 cursor 具有相同的底层 cursor 前缀：

```text
<redacted>
```

这支持了一个结论：

> GraphQL 当前页并没有到达 blocked relationship collection 的真实末尾。

即使 GraphQL 这一页没有任何可显示用户，服务端仍然提供了继续分页的位置。

---

## 为什么 suspended 账号很重要？

即使目标账号已经被 X suspended，block relationship 仍然可能继续存在。

在实际观察的数据里，大量历史被拉黑账号在账号状态查询中已经表现为 suspended，但底层 block relationship 依然存在。

因此这些账号仍然会占据 blocked-account collection 中的位置，只是不会再被 GraphQL timeline 渲染成正常可显示用户。

当这样的账号刚好填满整页时，客户端就可能收到：

```text
0 个可渲染用户
+
有效的下一页 cursor
```

这正是触发当前分页问题的边界情况。

理论上账号不可渲染还可能有其他原因，但在本次诊断里，suspended 是最主要的已观察原因。

---

## 为什么“清理历史黑名单”不是根因？

问题经常在大量清理历史拉黑账号之后变得明显，所以很容易误以为是“清理操作导致了 Bug”。

这个结论过强。

更准确的模型是：

```text
清理移除了大量仍然可显示的 blocked accounts
        ↓
无法渲染的历史关系变得更加集中
        ↓
更容易在靠前位置形成整页空白
        ↓
原本就存在的分页 Bug 被暴露出来
```

所以，清理只是一个**暴露因素**，并不是底层 Bug 的根因。

即使完全不清理，只要以后滚动到一个“空白但仍有下一页”的分页，同样可能发生问题。

---

## 为什么一个可见的“锚点账号”不能真正修复官方页面？

如果新拉黑一个较新的正常账号，它可能会进入列表前部，从而让第一页重新出现内容。

这可能让官方「已屏蔽账号」页面看起来暂时恢复。

但它并没有解决真正的分页问题。

一个很关键的情况是：

```text
列表前部已经有一个较新的可见账号
        ↓
第一页不再空白
        ↓
此时你又拉黑一个较老的账号
        ↓
这个较老账号排在空页区域之后
        ↓
官方 UI 仍然会在到达它之前停止
```

所以，即使“锚点账号”仍然可见，**此时新拉黑一个较老账号，依然可能完全不会出现在官方列表里。**

只要后续分页再次遇到：

```text
0 个可显示用户
+
有效 Bottom cursor
```

官方 UI 就仍然可能停止。

因此：

```text
列表前部有一个可见账号
≠
官方黑名单已经真正修复
```

锚点只能让列表前部重新显示内容，不能恢复官方 UI 跨过后续空页的能力。

---

## 正确的分页行为应该是什么？

客户端不应该只根据“当前渲染了多少个用户卡片”来判断是否已经到底。

更安全的逻辑应该是：

```text
如果 visibleUsers.length === 0
并且存在 Bottom cursor
并且 Bottom cursor 没有重复
并且 Bottom 方向没有真正结束
那么继续分页
```

只有出现下面情况之一时才应该停止：

- Bottom 方向明确终止；
- 没有返回 `Bottom` cursor；
- cursor 重复；
- 达到合理的安全页数上限；
- 请求失败或触发 rate limit。

也就是说，应该以 cursor 状态作为分页是否结束的主要依据，而不是把“当前页 0 个可显示账号”直接等同于“列表已经结束”。

---

## 本项目的问题缓解工具做了什么？

仓库里的 userscript 就是在客户端实现上面的分页规则。

它会：

- 读取 `BlockedAccountsAll`；
- 持续跟随有效的 `Bottom` cursors；
- 自动跳过 0 个可显示用户的空页；
- 遇到 HTTP `429` 时停止；
- cursor 重复时停止；
- timeline 真正到底时停止。

它不会：

- 拉黑账号；
- 解除屏蔽；
- 调用 `blocks/destroy`；
- 修改用户的 blocked-account relationships。

因此它是在缓解显示 / 分页问题，而不是修复 X 服务端本身。

---

## Query ID 变化

X 的 GraphQL query ID 是生成式的，可能随着前端部署发生变化。

因此脚本会：

1. 尝试从浏览器 resource timing 中识别近期的 `BlockedAccountsAll` query ID；
2. 如果无法识别，则使用本版本测试时有效的 query ID 作为 fallback。

如果 X 修改了 operation 结构、feature flags 或 query ID 形式，脚本可能需要更新。

---

## Rate limit

查看器使用的是只读 GraphQL 请求。

当前每页之间等待：

```text
300 ms
```

只读接口同样可能受到 rate limit。

因此脚本遇到：

```text
HTTP 429
```

会立即停止，不会不断重试。

不同用户需要跨过多少分页差异可能非常大，尤其是历史黑名单特别大，或者长期使用自动 / 批量拉黑工具的账号。

---

## 隐私与安全

公开的 Bug 报告或 GitHub Issue 中不应该包含：

- cookies；
- `ct0`；
- `x-csrf-token`；
- `x-client-transaction-id`；
- 其他与当前登录会话有关的请求头。

公开 userscript 也不应该嵌入用户专属的 session credentials 或抓取到的 transaction ID。

本工具只在用户自己的浏览器中读取当前 X 登录会话。

---

## 建议的产品级修复

从产品逻辑上看，修复点很简单：

> 当当前页没有任何可渲染账号，但仍然存在有效且未重复的 `Bottom` cursor 时，不应该终止「已屏蔽账号」分页。

官方客户端应该继续请求，直到 Bottom 方向真正结束，或者已经不存在 continuation cursor。

---

## 问题范围

这份分析描述的是一个**产品正确性 / 分页问题**，不是安全漏洞。

主要影响是：底层 block relationships 仍然存在，但用户无法通过官方 Web / App UI 正常查看自己的全部已屏蔽账号。

---

## 测试时间

已在 **2026-08-30** 的 X Web 上复现。
