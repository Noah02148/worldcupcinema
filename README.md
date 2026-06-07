# World Cup Cinema

用电影海报排的 2026 世界杯**小组赛**赛程网页。每支球队的每场比赛用一部电影代表;
点进国家页看它的三场对阵 + 代表电影。纯静态站,部署在 GitHub Pages。详见
[`worldcupcinema-spec.md`](./worldcupcinema-spec.md)。

> **数据/海报已「烘焙」进仓库**,网站从自身 github.io 同源加载(配合 jsDelivr CDN),
> 不在运行时依赖 Google Sheets / TMDB —— 两者在中国大陆被墙,否则页面会卡在「加载中…」。
> Google Sheet 仍是**唯一数据来源**,由一个 GitHub Action 定时同步到仓库。

## 结构

```
index.html                     页面骨架(header / tabs / 语言 / 投稿)
css/styles.css                 暗色 + 荧光绿,海报 2:3
js/i18n.js                     UI 文案 + 语言/时区(中→北京,英→美东)+ 城市中文
js/data.js                     读 data/*.csv + 比分,建模
js/app.js                      hash 路由 + 渲染(主页 / 国家页 / 淘汰赛占位)
build_data.py                  把 Sheet/比分/海报烘焙进仓库(见下)
.github/workflows/sync.yml     定时同步的 GitHub Action
data/*.csv, data/results.json  烘焙出来的数据(自动生成,勿手改)
assets/posters/                烘焙出来的海报(自动生成)
assets/moon.jpg                「待添加」占位图(月球环游记,公有领域)
.nojekyll                      让 GitHub Pages 原样发布目录
```

## 数据源

Google Sheet `FILE_ID = 1oMyg38c0hP450iMUUz5ctdXt1S0bs3sj53luddQd3vU`,
四个 tab:`countries / films / fixtures / strings`。前提:共享设为「知道链接的任何人 → 查看者」。

- `strings` tab 为空时用 `js/i18n.js` 内置默认文案;填了以表为准。
- `poster_url` 填 TMDB 地址(任意尺寸均可,烘焙时统一压成 w185);为空/「待定」显示占位。
- 比分来自 ESPN(`fifa.world` 记分牌),实时优先;拿不到时回退烘焙的 `data/results.json`。

## 更新数据(改完 Google Sheet 之后)⭐

改完 Sheet 后,需要让烘焙数据跟着更新,网站才会变。

### 方式一:手动触发 Action(推荐,约 10 秒生效)

1. 打开仓库,点顶部 **Actions** 标签(不在 Code 页里)
2. 左侧工作流列表点 **Sync sheet, results & posters**
3. 右侧点 **Run workflow** 按钮 → 分支保持 `main` → 点绿色 **Run workflow**
4. 等这一行出现新运行并变绿勾(~10 秒)
5. 回到网站 **硬刷新(Cmd+Shift+R)**

### 方式二:等定时任务

Action 每 15 分钟自动跑一次。⚠️ GitHub 定时调度**经常延迟**(可能拖几十分钟甚至偶尔跳过),
要立刻生效请用方式一。

### 方式三:本地命令行

```bash
python3 build_data.py                      # 拉 Sheet/比分 → data/,下载新海报 → assets/posters/
git add -A && git commit -m "data" && git push
```

> `build_data.py` 做三件事:导出 4 个 tab 到 `data/*.csv`、抓 ESPN 记分牌到 `data/results.json`、
> 把 films 里引用的 TMDB 海报下载到 `assets/posters/`(压成 w185)。

## 本地预览

```bash
python3 build_data.py            # 想预览 Sheet 最新改动时先跑一次(本地读的是烘焙好的 data/)
python3 -m http.server 8000 --bind 127.0.0.1
# 打开 http://localhost:8000
```

- 本地读 `data/` 里烘焙好的文件,**不再实时连 Google**;要看 Sheet 新改动先跑 `build_data.py`。
- `?lang=en` 强制英文;`?today=YYYY-MM-DD` 预览「今日置顶 / 已完赛」的排序。
- `--bind 127.0.0.1` 是为了避免只绑 IPv6 导致浏览器打不开。

## 部署到 GitHub Pages

已部署:**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**。
推送到 `main` 即自动重建(Action 的同步提交也会触发)。访问
`https://<用户名>.github.io/worldcupcinema/`。

> 临时项目,无自定义域名;世界杯结束后把仓库设为 private 或删除即可下线。
