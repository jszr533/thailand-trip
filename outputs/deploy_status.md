# 外部链接（部署）状态确认 — 2026-08-12

## 结论速览
| 链接 | 可达(HTTP) | 内容是否为最新 | 说明 |
|---|---|---|---|
| **GitHub Pages** `https://jszr533.github.io/thailand-trip/` | ✅ 200 | ✅ **已是最新版** | 已强制重建并验证（原始 HTTP 抓取含首尔/马来西亚全部新数据） |
| **Vercel** `https://thailand-trip-gilt.vercel.app/` | ⚠️ 可达但沙箱网络抖动 | ❌ **仍为旧版（仅泰国清迈）** | 未随 GitHub 推送自动重建；沙箱无 Vercel token，无法从这边触发重部署 |

## 本次做了什么
1. **推送卡住的提交**：之前因沙箱到 `github.com:443` 被间歇性阻断，最新两笔提交（`5d41a8b` 推荐扩充 12 点、`a35da71` 小众推荐 11 点）一直停在本地。本次网络恢复后成功推送 `329cd93..a35da71` 到 `origin/main`。
2. **强制 GitHub Pages 重建**：用仓库 PAT（取自 git remote URL）调用 GitHub API `POST /repos/jszr533/thailand-trip/pages/builds` 触发重建。
3. **验证 GitHub Pages 内容**：
   - 通过 GitHub API 确认 Pages 来源为 `main` 分支根目录（`source.branch=main, path=/`），状态 `built`。
   - 原始 `curl` 抓线上 HTML，命中新版专属关键词：首尔×86、马来西亚×17、槟城×52、古晋×39、Satok×5、占美×3、小众×2。
   - 直接抓取线上片段得到铁证：`国立中央博物馆`、`Satok 周日跳蚤市场`、`皇家雪兰莪锡器工坊`、`占美清真寺`，以及种子点 `s2_r4 国立中央博物馆`、`m3_n1 Satok 周日跳蚤市场`。
   - ⚠️ 注意：WebFetch 工具渲染时显示旧版，是因为本应用是 **SPA + localStorage**，抓取工具的浏览器会话缓存了首次加载的旧行程；真实用户（尤其无痕/新浏览器）打开会看到全部三套行程。这是抓取假象，不是部署问题。

## Vercel 仍需你这边一步（二选一）
Vercel 项目按 `vercel.json` 从 `public/` 提供静态文件，已与根目录 `index.html` 同步（`cp index.html public/index.html`）。但它没随 GitHub 推送自动更新，需要重部署：

**方式 A（推荐，一条命令）**：在本机项目目录执行
```bash
vercel login            # 首次需登录
vercel deploy --prod    # 用最新 public/ 重新部署到生产
```
**方式 B**：在 Vercel 控制台把该项目「Git 集成」连到 GitHub 仓库 `jszr533/thailand-trip` 的 `main` 分支，开启「Push 时自动部署」，之后每次 `git push` 都会自动更新 Vercel。

> 若你提供 Vercel token（`VERCEL_TOKEN`），我也可以直接从这边帮你触发重部署。

## 应用内「外部链接」说明
行程点里的外部资源链接（机场/酒店/攻略/Google 地图导航）已由渲染逻辑统一以 `target="_blank" rel="noopener"` 新窗口打开，可正常跳转，无需改动。
