# 视觉重构 · 第 2 步：配色收敛 + 字体/配色关系 + Hero 重做

日期：2026-09-13
提交：`（见 git log）`
回滚点：`design-v2-base`（tag + 分支 `design/v2-base`，指向 06d1693 即第 1 步的成果）

---

## 0. 用户这次的四条要求（原话）

> 我觉得现在的改动有一部分很好，在于改字体大小；但是亮色下面的墨绿色有点不符合凉风凉的风格，我希望
> 1：使用颜色全部都是我给你提供的凉风凉主题色；
> 2：重点在于修改字体和配色关系来增强高级感；
> 3：我希望主页面上面的中心大块的背景颜色可以流动；
> 4：我希望暗色的中心大块可以修改一下。

---

## 1. 那条「墨绿色」到底是什么

**结论：是 `#2F6B4F`（森林绿 / 变量 `--forest-green`），不是天空蓝墨色 `#2E6E92`。**

核实过程（不靠猜）：

1. 拉线上「关于页」当前版本原文（Supabase `about_versions` 最新一条，2026-09-12）——
   「主题灵感」只写了四个颜色：
   > 网站配色灵感来自凉风凉：天空蓝的开衫、蜜金渐变珊瑚粉的长发、清透青蓝的眼睛，以及清新却难以触碰的校园风。
2. 全站 CSS 里唯一不属于这四色的色相，就是 `#2F6B4F`（hue≈155 的绿）。其余深色（`#2E6E92 / #2A6577 / #35769B / #2A6386`）都是天空蓝/青蓝同色相的深色档，不是另一个色相。
3. 亮色主题下它出现在最显眼的地方：首页「小说」分区标题、小说卡占位封面（`#2F6B4F → #2A6577` 一大块）、已完结徽章、小说书架页头、成功提示文字。

所以「墨绿不符合凉风凉的风格」＝森林绿这个色相本来就不该进站。

---

## 2. 改了什么

### 2.1 配色收敛（要求 1）

| 位置 | 改前 | 改后 |
| --- | --- | --- |
| `--forest-green` | `#2F6B4F` | **删除**（新增 `--aqua-ink: #2A6577` / `--aqua-fill: #2A6577` 顶替它的岗位） |
| 分类「小说」 | 墨绿 `#2F6B4F` | 蜜金装饰 `#E8C9A0` + 蜜金墨色 `#8F6220` |
| 小说状态「已完结」 | 墨绿 | 天空蓝 `#5BA8D8` / 墨色 `#2E6E92` |
| 小说书架页头（Novels.tsx） | `--cat-tint/-accent: #2F6B4F` | 蜜金 `#E8C9A0` / `#8F6220`（与 CATEGORY_META 对齐） |
| 小说卡占位封面 | `linear-gradient(135deg,#2F6B4F,#2A6577)` | `linear-gradient(140deg,#4A9BB8,#2A6577)`（青蓝） |
| 成功/提示类文字（留言成功、验证码提示、关于页保存、友链保存、草稿已保存） | 森林绿 | 青蓝墨色 `--aqua-ink` |
| 关于页色卡装饰行 | 6 个（含灰蓝、森林绿） | 4 个＝「主题灵感」原文点名的四色 |

色卡定稿（唯一允许的取色来源）：天空蓝 `#5BA8D8`、蜜金 `#E8C9A0`、珊瑚粉 `#E89B8A`、青蓝 `#4A9BB8`；灰蓝 `#8A8F9A` 只当灰用。
深色档（承载白字/文字用）：`#2E6E92 / #8F6220 / #A8482F / #2A6577 / #5C6469`。

### 2.2 字体 × 配色关系（要求 2）

- ~~新增 `--font-display` 中文衬线~~ **已于同日撤回**：用户看到线上效果后原话「不要用宋体，太诡异了」——衬线栈在 Windows 上会落到 SimSun（宋体），大标题下又虚又怪。现 `--font-display: var(--font-sans)`，即全站回到无衬线；变量保留只为将来换字体时一行切换。
- 字重：大标题 `800/900 → 700`（原超粗体是廉价感来源之一）；卡片标题 `700 → 600`。
- 字距拉开：Hero 标题 `.18em`、副标题 `.22em`（都配 `text-indent` 等值抵消居中偏移）、页面标题 `.06em`、分区标题 `.04em`；正文行高 `1.7 → 1.78`，Hero 简介 `2.05`、测宽收到 `540px`。
- Hero 垂直留白 `56px → 68px`，主色块圆角 `26px → 28px`；分区标题强调竖条 `5×22px 深青渐变 → 4×20px 天空蓝→青蓝`。

### 2.3 Hero 背景流动（要求 3）

- `--hero-flow`：一条 115° 浅色渐变，色标全部由色卡 `color-mix` 出来（天空蓝 20% → 白 → 蜜金 26% → 珊瑚粉 16% → 青蓝 18% → 天空蓝 20%）。
- `background-size: 260% 260%` + `@keyframes heroFlow`（26s，`background-position` 0%↔100% 往返）＝ 颜色缓慢流动。
- 另加两个模糊光斑 `.hero::before`（珊瑚粉）与 `::after`（天空蓝），分别 32s / 40s 漂移+缩放，让「流动」看得出来。
- `@media (prefers-reduced-motion: reduce)` 下全部关闭动画。

### 2.4 暗色 Hero 重做（要求 4）

改前：一整块 `linear-gradient(135deg, 亮天空蓝 → 亮蜜金)` 的彩色横幅 + 白字（白字压亮底，既晃眼又廉价）。
改后：与亮色同一套结构，底子换深色 —— `--hero-flow` 在暗色下是「深蓝灰底 + 极淡的青蓝/珊瑚辉光」，
标题回到 `--text-main`、副标题用天空蓝 `#6ec3ef`、简介用 `--text-secondary`，主按钮改为天空蓝实底 + 深字 `#0e1c26`。

**踩到的坑（已修）**：暗色那条规则一开始写成 `background: var(--hero-flow)` 简写，简写会把基础规则里的
`background-size:260% 260%` 重置成 `auto`，暗色的流动直接失效（headless Chrome 实测 `backgroundSize: auto`）。
改成 `background-image` 长写后恢复为 `260% 260%`。**以后在 `.hero` 上覆盖背景，一律用长写。**

---

## 3. 验收（实算，不靠眼估）

1. `npm.cmd run build` 通过（tsc 类型检查在前，通过即代表类型无错）。
2. `node scripts/audit-contrast.mjs` —— **42 项全部 PASS，FAIL 0 / 偏低 0**。
   新增条目涵盖 Hero 渐变的四个色标（`#DEEEF7 / #F9F1E6 / #FBEFEC / #DEEDF2`）与暗色 Hero 最亮色标 `#223746`。
3. headless Chrome 实测计算样式（light + dark 各跑一遍，静态 `data-theme`）：
   - 亮色：`background-size: 260% 260%`、`animation: heroFlow 26s`、标题 `52.8px w700`、副标题 `#2E6E92`；
   - 暗色：`background-size: 260% 260%`（修复后）、渐变解析为深蓝灰 + 色卡淡彩、副标题 `#6ec3ef`、主按钮 `#6ec3ef` 底 + `#0e1c26` 字。
   - 两套 `--hero-flow` 的 `color-mix` 均被浏览器解析成实际 rgb，无变量失配。

---

## 4. 回滚

```powershell
# 方式一：整站回到第 1 步结束时的状态
cd C:\Users\Saber\Desktop\AI-Projects\blog
git checkout design-v2-base        # 或 git reset --hard design-v2-base

# 方式二：只回滚文件（快照在 first\design-v2-base\，含构建产物 css）
Copy-Item C:\Users\Saber\Desktop\AI-Projects\first\design-v2-base\src\index.css C:\Users\Saber\Desktop\AI-Projects\blog\src\index.css -Force
```

`first\design-v2-base\` 内容：`src\index.css`、`src\types\index.ts`、`src\pages\About.tsx`、`src\pages\Novels.tsx`、`index-BCv9YNbL.css`（改动前的构建产物）。

---

## 5. 下一步（未做，等确认）

- 第 3 步「砍装饰」：13 处 `linear-gradient`、44 处彩色 rgba 阴影、34 处 hover `translateY`、彩虹渐变滚动条、emoji 图标。
- 第 3 步「尺度系统」：font-size 220 处 48 种取值 → 7 级字阶；padding 97 种 → 4px 阶；radius 19 种 → 3 级。
- 暗色主题剩余的「白字压亮色激活态」约 25 处（`.filter-chip.active` / `.guestbook-tab.active` 等，≈2.1:1），要修时删掉 `index.css` 末尾的暗色还原块。
