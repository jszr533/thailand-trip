# 跨页逻辑一致性审查与修复

审查目标：各页面（足迹首页 / 城市库 / 城市指南 / 行程）之间的数据是否一致。
验证手段：新增 `qa_crosspage.js`（jsdom 跨页专项，30 项断言），并回归全量 QA。

## 发现并修复的 3 类跨页逻辑问题

### BUG 1 — 城市指南误显示「泰国」签证/交通规则（最严重）
- **现象**：打开「首尔 / 槟城 / 古晋 / 吉隆坡」的城市指南，「入境须知」显示的是「中泰永久互免签证」，交通须知也是泰国 BTS/MRT。
- **根因**：`renderCityEntry` / `renderCityTransit` 硬编码引用 `ENTRY_NOTES`（中泰互免）与 `CITY_TRANSIT`（仅曼谷/清迈），没有按城市所属国家区分。而**行程页**早已改为按国家查 `COUNTRY_GUIDES`——两套「入境须知/交通」内容互相矛盾。
- **修复**：两个函数改为通过新增 `cityCountryOf(city)`（用 `CITY_DB[name][2]` 取国家）查 `COUNTRY_GUIDES`，与行程页完全一致；国家未收录时给中性兜底提示（不再误显示泰国）。删除已无用的 `ENTRY_NOTES` / `CITY_TRANSIT` 死代码。

### BUG 2 — 槟城/古晋 不在基础表，导致世界级足迹与直达都失效
- **现象**：世界地图「我的足迹」只点亮吉隆坡，缺槟城、古晋；点世界地图上的「槟城」会跳错行程。
- **根因**：`CITY_DB` 没有「槟城」「古晋」；`CITY_SLUG` 也没有 `penang`/`kuching`/`kuala_lumpur`/`seoul`。`syncCities` 把马来西亚行程 day.city 的 slug 解析成无国家、无坐标的原始字符串，被 `aggregateCities()` 过滤掉。
- **修复**：
  - `CITY_DB` 增加 `槟城:[5.41,100.33,'马来西亚']`、`古晋:[1.55,110.36,'马来西亚']`
  - `CITY_SLUG` 增加 `penang→槟城`、`kuching→古晋`、`kuala_lumpur→吉隆坡`、`seoul→首尔`
  - 修复后：世界地图足迹完整显示槟城/古晋/吉隆坡（归属 亚洲·马来西亚）；`jumpToCityTrip('槟城')` / `('古晋')` 正确直达马来西亚行程。

### BUG 3（BUG 2 的连锁）— 城市指南国家识别失败
- 因槟城/古晋 取不到国家，城市指南即使改成按国家查也会回退到「无国家」，修复 BUG 2 后自动解决。

## 校验结果
- `qa_crosspage.js`：**30/30 通过，0 运行时错误**（行程 cities 均有国家+坐标、世界地图含槟城/古晋、城市指南按国家显示且不串台、行程 guide 按国家、jumpToCityTrip 直达正确）。
- 全量回归：`qa_runtime` / `qa_deep` / `qa_seoul` / `qa_malaysia` / `qa_country_guides` 全部 **0 运行时错误**。
- `qa_business_hours`：剩余 4 个 ❌ 均为**泰国清迈已完成行程**（8.2 周日、8.3 周一市集）——属此前约定「已结束行程不修改」范围，未动。

## 部署
- 已 `git push origin main`（`c1fb16c..fac00c0`）。
- GitHub Pages 线上已确认含修复（`curl` 命中 `cityCountryOf` / `槟城` / `古晋` / `MDAC`）。
- 主链接：`https://jszr533.github.io/thailand-trip/`（建议无痕窗口，避免 SPA+localStorage 缓存旧行程）。
- Vercel 仍为旧版（沙箱无 token 无法触发重部署），需在用户本机 `vercel login && vercel deploy --prod`，或 Vercel 控制台连 GitHub 开启 Push 自动部署。
