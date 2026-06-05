# World Cup Cinema — Build Spec (v1, rev. 2026-06)

> 一个给自己和电影朋友用的 2026 世界杯**小组赛**赛程网页:普通赛程表太无聊,改用电影海报来排。
> 每支球队的每场比赛用一部电影代表;点进国家页看它的三场对阵 + 代表电影。
> **临时项目**,世界杯结束即可下线。

---

## 0. 性质与托管
- 个人 / 小圈子工具,**世界杯结束后下线**,不追求长期运营。
- **无自定义域名**;静态站托管在 **GitHub 仓库 + GitHub Pages**(沿用以前方式)。
- 内容读 Google Sheet(gviz CSV,运行时 fetch,无后端、无 key)。
- 分发:世界杯期间,在我的 **Letterboxd 插件页面**放一段介绍 + 跳转到本赛程站。

## 1. 范围
- 只做**小组赛**:72 场,12 组(A–L),48 国,每国 3 场。
- 顶部大 tab:`小组赛` / `淘汰赛`;**淘汰赛先留空**(对阵依赖结果,占位即可)。
- 小组赛内:`按日期` / `按小组` 两种排列。
- 中英切换;**语言决定时区**(见 §4)。
- 本期**不做**:点赞、用户投稿(投稿我另用别的表处理)。
- 本期**去掉**:各国电影工业介绍 / 图鉴文案。

## 2. 页面

### 2.1 主页 / 赛程
- 顶部:站名 + 大 tab(`小组赛` | `淘汰赛`)+ 语言切换(`中` | `EN`)。
- 小组赛视图切换:`按日期` | `按小组`。
- **比赛卡**(每场一张):
  - meta 行:`组别 · 时间 · 城市`(时间按语言显示北京 / 美东,见 §4)。
  - 主体:`海报A — VS — 海报B`,海报下 `国旗 + 国名`;墙上**不显片名**(hover 浮现)。
  - 每场比赛有一个 **matchday(1/2/3)**;该场两队**都用各自 `slot = matchday` 的那部电影**代表 ⇒ 同一个国家在它三场比赛里会出现**三张不同海报**。
  - 点海报 / 国名 → 该国国家页。
- 淘汰赛 tab:占位页(显示「赛程待定」即可)。

### 2.2 国家页
- 该国 **三场小组赛对阵**(对手 + 时间 + 地点)。
- 下面:**最多三部电影**的列表 —— 每场(matchday)对应一部,**导演各不相同**;**fallback 国家暂时只放一部**。
- 每部片挂 **Letterboxd 链接**(点击跳转)。
- 无文字介绍。

## 3. 数据模型(Google Sheet → gviz CSV)

- FILE_ID = `1oMyg38c0hP450iMUUz5ctdXt1S0bs3sj53luddQd3vU`
- 读取:`https://docs.google.com/spreadsheets/d/<FILE_ID>/gviz/tq?tqx=out:csv&sheet=<tab>`
- 前提:文件共享设为「知道链接的任何人 → 查看者」。

### tab `countries`(48 行)
`country_id, group, country_zh, country_en, flag, status(✅/🟡/🔴), fallback_type(none/soft/hard)`
> 旧的 `thesis_*` / `blurb_*` 列本期不用,留着无妨,前端忽略即可。

### tab `films`(每国 1–3 行)
`country_id, country_zh, slot(1/2/3), title_zh, title_en, title_original, year, director, letterboxd_url, poster_url, status(live/pending)`
- `country_zh` 只是方便人工定位的辅助列;程序仍按 `country_id` 与 `countries` 关联。
- `slot` = 这部片代表该国第几场小组赛(matchday)。
- 普通国家填 **3 部**(slot 1/2/3,**导演互不相同**);**fallback 国家只填 slot 1**。
- 渲染:某场比赛 matchday=M,主/客队各取自己 `slot=M` 的片;若该队没有 slot=M(fallback),**回退到 slot 1**。

### tab `fixtures`(72 行)
`match_id, group, matchday(1/2/3), date, kickoff_et, venue_city, home_id, away_id`
- `kickoff_et` = **美东时间**(整个赛事都是 EDT / UTC−4),作为唯一基准时间,其余时区由前端换算。填表时若赛程源给的是场馆当地时间,先统一换成美东再填。

### tab `strings`(界面 i18n)
`key, en, zh` —— 导航、`小组赛/淘汰赛`、`按日期/按小组`、`VS`、星期月份、hover 提示等固定文案。

## 4. 语言 + 时区
- 切换 `中 / EN`:文案在 `*_zh` / `*_en` 与 `strings` 间切换(纯前端重渲染,不重新请求)。
- **时间随语言切换**:
  - 中文 → **北京时间**(UTC+8)= `kickoff_et` + 12 小时(夏季固定;注意可能跨到次日)。
  - English → **美东时间 ET**(直接显示 `kickoff_et`)。
  - 实现建议:把 `date + kickoff_et` 当作 UTC−4 的时刻构造,用 `Intl.DateTimeFormat` 分别按 `Asia/Shanghai` 与 `America/New_York` 渲染,跨日自动处理。
- 语言记忆:`?lang=` 参数或 localStorage。
- (若以后想两个时区**同时显示**而非随语言切换,是个小改动。)

## 5. 视觉
- 暗色背景 + 荧光绿 `#C6FF00`(Letterboxd 海报墙气质)。
- 海报统一 **2:3** + `object-fit: cover`(与 TMDB / Letterboxd 同比例,不裁图);墙上不放片名。
- 卡片 `#111` / 海报槽 `#1a1a1a` / 描边 `#262626`–`#333`;文字 `#eee`/`#888`/`#666`;圆角 10–14;无衬线。

## 6. 技术 / 部署
- 纯静态(HTML/JS 即可),用 PapaParse 解析 CSV。
- 运行时 fetch 上述 4 个 gviz CSV;无 key、无后端。
- 部署 GitHub Pages(仓库 → Settings → Pages)。
- 海报引用 TMDB 图地址,不自存。

## 7. Fallback 名单(决定哪些国家只放 1 部)
- **hard(5)**:卡塔尔 QAT、库拉索 CUW、佛得角 CPV、乌兹别克斯坦 UZB、巴拿马 PAN
- **soft(5)**:海地 HAI、巴拉圭 PAR、厄瓜多尔 ECU、伊拉克 IRQ、刚果(金) COD
- 这 **10 国** `films` 暂时只填 slot 1;其余 **38 国**填满 slot 1/2/3(不同导演)。

## 8. 现有 seed 状态
- `films` 表里现有的 48 部 = 各国 **slot 1**(已导入)。
- 待补:为 38 个非 fallback 国家加 **slot 2、slot 3**(不同导演)+ 全部填 `poster_url`(TMDB)/ `letterboxd_url` / 英文片名。
- `fixtures` 72 场按官方赛程补全(含 `matchday`)。
- 卡塔尔、乌兹别克两行仍是 `pending`,定下来转 `live`。

## 9. 对现有 Sheet 的改动(很小)
- `films` 标签:去掉 `is_representative / source / display_order`,加一列 `slot`,**现有行全设 slot=1**;再为 38 国补 slot 2/3 行。
- `countries` 标签:保持即可(多余的 thesis/blurb 列不用管)。
- 顶部大 tab 的「淘汰赛」本期只做占位。
