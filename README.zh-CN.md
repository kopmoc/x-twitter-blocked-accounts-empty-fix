# X / Twitter 已屏蔽账号空白修复工具

[![English](https://img.shields.io/badge/README-English-1d9bf0)](README.md)

一个只读的 X/Twitter「已屏蔽账号」问题缓解工具，用于处理**页面空白、显示不完整，或者刚拉黑的账号不出现在列表里**的问题。

---

## 这个工具解决什么问题？

这个工具针对的是 X/Twitter「已屏蔽账号」页面**空白、显示不完整，或者刚拉黑的账号不出现在列表里**的问题。

比较常见的情况包括：

- 你过去手动拉黑过大量广告号、垃圾账号、诈骗号或 bot；
- 你长期使用过带有**自动拉黑 / 批量拉黑**功能的浏览器插件、脚本或过滤工具；
- 多年后，这些历史账号中有很多被 X 官方封禁；
- 你的黑名单因此积累了大量已经无法正常显示的历史账号。

当这些账号连续占据列表中的某一段时，X 官方页面可能提前停止加载，导致后面的正常已屏蔽账号无法显示。

最明显的症状是：

> **你刚刚成功拉黑了一个正常账号，个人资料页明确显示“已屏蔽”，但在「已屏蔽账号」页面里却找不到它。**

---

## 清理过去的拉黑账号，是触发这个问题的必要条件吗？

**不是。**

清理大量历史拉黑账号会让这个问题更容易暴露，但不是必要条件。

即使你从来没有清理过，只要列表中出现一段“这些账号已经无法正常显示，但后面其实还有其他已屏蔽账号”的区域，官方页面仍然可能在这里停止加载。

所以：

> **清理旧黑名单不是根因，只是可能让这个问题更明显。**

---

## 为什么较早和较晚创建的账号会表现不同？

在受影响的账号上，可能会出现一种近似的“时间分界”：

- 较新的账号还能正常出现在官方列表里；
- 较老的账号虽然已经成功拉黑，却可能排在空页后面，因此官方页面看不到。

这个分界和账号 ID / 创建时间有关，但**不是 X 全局统一的固定日期**。不同用户的历史黑名单数据不同，分界位置也会不同。

更详细的排序和 Snowflake 分析见：

[`docs/bug-analysis.zh-CN.md`](docs/bug-analysis.zh-CN.md)

---

## 为什么页面会空白？

简单来说，X 的「已屏蔽账号」列表在遇到一整页都无法正常显示的历史账号时，可能错误地停止继续加载。于是后面其实还存在的已屏蔽账号就无法显示出来。

更详细的 GraphQL 返回结构和分页分析见：

[`docs/bug-analysis.zh-CN.md`](docs/bug-analysis.zh-CN.md)

---

## 这个工具做什么？

这个工具会在官方页面停止加载后，继续沿着后续分页查找，并跳过这些“空页”，把后面仍然可以正常显示的已屏蔽账号找出来。

它是只读工具，不会修改你的黑名单关系。

实现细节见：

[`docs/bug-analysis.zh-CN.md`](docs/bug-analysis.zh-CN.md)

---

## 安全性

这是一个**只读工具**。

它不会：

- 拉黑任何账号；
- 解除任何账号的屏蔽；
- 调用 `blocks/destroy`；
- 修改 X 账号设置；
- 把你的黑名单上传到第三方服务器。

它只读取当前浏览器登录会话中的 `BlockedAccountsAll` timeline。

工具会在以下情况自动停止：

- HTTP `429`；
- cursor 重复；
- 不再存在新的 `Bottom` cursor；
- 已经真正到达 timeline 底部。

默认分页间隔：

```text
300 ms
```

---

## 使用方式

这个工具有两种运行方式。

### 方法一：直接在浏览器 F12 控制台运行

这是最直接的方式，不需要安装任何扩展。

1. 登录 X。
2. 打开：

```text
https://x.com/settings/blocked/all
```

3. 按 `F12` 打开开发者工具。
4. 切换到 **Console / 控制台**。
5. 打开仓库中的 `x-twitter-blocked-accounts-empty-fix.user.js`。
6. 复制完整 JavaScript 代码。
7. 粘贴到 Console。
8. 按 Enter 运行。

运行后，页面右侧会出现一个浮动查看器。

> Chrome / Chromium 浏览器有时会在第一次向控制台粘贴代码时显示安全提示。请只运行你已经查看并确认内容的代码。本项目源码是公开的，建议先阅读再运行。

### 方法二：Tampermonkey / Violentmonkey

如果需要反复使用：

1. 安装 Tampermonkey 或 Violentmonkey。
2. 新建一个 userscript。
3. 用 `x-twitter-blocked-accounts-empty-fix.user.js` 替换默认内容。
4. 保存。
5. 登录 X。
6. 打开：

```text
https://x.com/settings/blocked/all
```

脚本会自动加载查看器。

---

## 面板使用方法

面板提供：

- **扫20页**：本轮最多扫描 20 个 GraphQL 页面，并自动跳过空页；
- **扫100页**：本轮最多扫描 100 个 GraphQL 页面；
- **停止**：停止当前扫描；
- **回到第一页**：重置分页并回到第一页；
- **筛选**：在已经找到的账号里搜索；
- **打开**：新标签页打开对应 X 账号。

---

## 技术分析

见：

[`docs/bug-analysis.zh-CN.md`](docs/bug-analysis.zh-CN.md)

---

## 兼容性

已在 **2026-08-30** 的 X Web 上测试。

X 经常修改内部 GraphQL query ID 和 feature flags，未来的 X 部署可能需要更新脚本。

脚本会尝试从浏览器 resource timing 中识别近期使用过的 `BlockedAccountsAll` query ID；如果没有找到，则使用本版本测试时有效的 query ID 作为 fallback。

---

## 隐私 / 安全

**不要**在 GitHub Issue、截图或提交给 X Support 的报告中公开以下内容：

- cookies；
- `ct0`；
- `x-csrf-token`；
- `x-client-transaction-id`；
- 其他与当前登录会话相关的请求头。

本仓库不会有意包含任何用户专属的会话凭据或抓取到的 transaction ID。

---

## 搜索关键词

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

## 免责声明

这是一个非官方的客户端问题缓解和诊断工具。

它用于帮助用户访问官方界面可能无法继续加载到的已屏蔽账号。本项目与 X Corp. 无关联，也不声称会修改或修复 X 服务端的数据。

---

## 许可证

MIT
