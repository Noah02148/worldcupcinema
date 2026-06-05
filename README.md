# World Cup Cinema

用电影海报排的 2026 世界杯**小组赛**赛程网页。每支球队的每场比赛用一部电影代表;
点进国家页看它的三场对阵 + 代表电影。纯静态站,内容运行时读 Google Sheet(gviz CSV),
无后端、无 key。详见 [`worldcupcinema-spec.md`](./worldcupcinema-spec.md)。

## 结构

```
index.html        页面骨架(header / tabs / 语言切换)
css/styles.css    暗色 + 荧光绿,海报 2:3
js/i18n.js        默认 UI 文案 + 语言/时区(中→北京,英→美东)
js/data.js        gviz CSV 抓取 + 解析 + 建模(PapaParse)
js/app.js         hash 路由 + 渲染(主页 / 国家页 / 淘汰赛占位)
.nojekyll         让 GitHub Pages 原样发布 js/ 目录
```

## 数据源

Google Sheet `FILE_ID = 1oMyg38c0hP450iMUUz5ctdXt1S0bs3sj53luddQd3vU`,
四个 tab:`countries / films / fixtures / strings`。
前提:文件共享设为「知道链接的任何人 → 查看者」。

- 数据**运行时**从 Sheet 读取,改完表刷新页面即可看到效果,无需重新部署。
- `strings` tab 为空时,界面用 `js/i18n.js` 里的内置默认文案;填了就以表为准。
- `poster_url` 为空时显示占位海报(暗纹 + 暗色片名),填了 TMDB 地址即显示真海报。

## 本地预览

任意静态服务器即可(数据仍走网络从 Google 读):

```bash
cd world-cup-cinema
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

可用 `?lang=en` 强制英文;语言/视图选择会记到 localStorage。

## 部署到 GitHub Pages

1. 新建仓库,把本目录内容推上去(含 `.nojekyll`)。
2. 仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   选 `main` 分支、`/ (root)` 目录,保存。
3. 等几十秒,访问 `https://<用户名>.github.io/<仓库名>/`。

> 没有自定义域名;世界杯结束后把仓库设为 private 或删除即可下线。

## 现状(v1 骨架)

- ✅ CSV 读取 + 解析 → 小组赛主页(按日期 / 按小组两视图,海报对决卡)
- ✅ 国家页(三场对阵 + 最多三部电影,Letterboxd 链接)
- ✅ 中英切换 + 时区随语言、暗色荧光绿视觉、淘汰赛占位
- ⏳ 待 Sheet 补全:`poster_url` / `letterboxd_url` / 英文片名 / slot 2·3 / fixtures
