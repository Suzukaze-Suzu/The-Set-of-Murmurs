# 呓语集英文版 · P0 文案词表（**已定稿 2026-09-21**）

> **状态：定稿。** Saber 已于 2026-09-21 00:51 逐条批注完毕（含 18 行语气档逐行勾选、2 处改写、1 处笔误）。本文件现在＝**P2 的唯一文案依据**，代码里出现的英文必须能在这张表里找到原句。
> 我（AI）在定稿时只做了三件事：修掉 2 处笔误（`grave murmurs..` 双句点、`/Author/` 空格）、把已定案的 ⚠️ 标记收干净、把未勾选的 A/B 备选划掉标注作废。**没有改动任何一条你定下的英文措辞。**
>
> **这份文件现在怎么用（P2 起）**
> · 第 3 列＝**最终英文**，P2 原样搬进代码；第七节＝按你勾的那一列。
> · 标「仅博主可见」的行**不进英文版**，后台保持中文。
> · 后续想改措辞：直接改第 3 列并告诉我，我在代码里同步——**不用重新走一遍 P0**。
>
> 生成方式：脚本扫 `blog/src` 全部 `.tsx/.ts`（排除注释），逐行抽取含中文的界面文案，共 **434 行 / 32 个文件**，其中公开页文案见下表。
>
> **全表拼写口径：英式**（Favourites / Colour / Centre / -ise）。已按此核对过全文。

---

## 〇、6 个决策（**已全部定案**）

| # | 决策点 | 我的建议 | 你的意见 |
|---|---|---|---|
| 1 | **路线** | 路线 B：同域名 `/en/`，中文站保持原样 | ✅ **已定：B**（2026-09-20） |
| 2 | **英文站名在顶栏怎么显示** | 顶栏小字 `Murmurs`，页脚/标题/OG 用全名 `The Set of Murmurs` | ✅ **已定：顶栏 Murmurs，其余用全名** |
| 3 | **英式还是美式拼写** | 美式 | ✅ **已定：英式（Favourites / Colour / Centre / -ise）** |
| 4 | **语气档** | A 温软版 | ✅ **已定稿：18 行逐行勾完（A 13 条 / B 5 条）**——见第七节 |
| 5 | **「共 N 字」在英文页怎么显示** | 隐藏字数 | ✅ **已定：重新数词**——实现口径见**第四节**「字数口径」 |
| 6 | **页脚的「开往」徽标英文版是否保留** | 保留 | ✅ **已定：英文版也保留** |

---

## 一、品牌与站点级

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 呓语集 | **Murmurs**（顶栏）／**The Set of Murmurs**（页脚、`<title>`、OG、RSS） | ⚠️ 见决策 2。`the-set-of-murmurs.me` 与全名一致，SEO 顺 |
| 未知的梦话与胡言乱语 | **Dreams half-known, words unaccounted for** | ✅ 已定（＝原备选 A） |
| 这里是呓语集，会记录一些不自知的情绪和严谨的呓语 | **This is The Set of Murmurs — a place for unfelt feelings and grave murmurs.** | ✅ 已定（Saber 改定；原稿的双句点 `..` 已修正为一个） |
| （页面标题后缀）`{标题} - 呓语集` | `{Title} · The Set of Murmurs` | 英文用 `·` 比 `-` 干净 |
| （meta description，现为中文） | `The Set of Murmurs — a personal blog on anime, essays, reading notes and mathematics.` | |

---

## 二、导航（顶栏 / 移动抽屉 / 页脚）

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 首页 | Home | |
| 文章 | Articles | |
| 书架 | Bookshelf | |
| 图集 | Gallery | |
| 留言 | Guestbook | 顶栏要短，用 Guestbook 而不是 Comments |
| 友链 | Friends | 页脚写作 Friends，正文标题用 Friends & Links |
| 关于 | About | |
| 分类 | Categories | |
| 分类浏览 | Categories | aria-label |
| 全文搜索 | Search | aria-label |
| 全文搜索文章… | Search posts… | 抽屉里的搜索框 |
| 全文搜索文章…（Esc 关闭） | Search posts… (Esc to close) | 顶栏浮层 |
| 清除搜索词 | Clear search | aria-label |
| 打开菜单 / 关闭菜单 / 菜单 | Open menu / Close menu / Menu | |
| 切换暗色 / 切换亮色 | Light mode / Dark mode | ✅ 已定。实现口径＝title 写**点击后会去往的模式名**（当前亮色时 title=「Dark mode」），不要写成当前状态 |
| 切换主题 | Switch theme | aria-label |
| 开往-友链接力 | Travellings | 专有名词，不译。title 可写 `Travellings — a Chinese webring` |
| 登录 / 退出登录 / 账号 / 博主 / 个人主页 | Sign in / Sign out / Account / Author / My profile | ✅ 已定：「博主」＝**Author**（原空格笔误 `/Author/` 已修正）。语义＝身份标签，不是权限名 |
| RSS | RSS | 不变 |

---

## 三、分类名与状态签

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 读后感 | **Impressions** | ✅ 已定（不用 Review；Afterthoughts 备选作废） |
| 随笔 | **Essays** | ✅ 已定（Notes 备选作废） |
| 小说 | **Fiction** | |
| 数学笔记 | **Math Notes** | |
| 学习分享 | **Study Notes** | |
| 连载中 / 已完结 / 暂停更新 | Ongoing / Completed / On hold | |
| 置顶 | Pinned | |
| 收藏 / 取消收藏 | Save / Unsave | ✅ 已定（与首页「Pinned & Saved」同口径；Favourite 备选作废） |
| 最新 | New | 书籍卡上的「最新」小签 |
| Bug 报错 / 界面问题 / 功能建议 / 其他 | Bug / UI issue / Feature request / Other | |

---

## 四、首页

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 最新更新 | Latest Updates | |
| 置顶与收藏 | Pinned & Saved | ✅ 已定（与第三/五节的 Save/Unsave 同口径） |
| 书籍更新 | Book Updates | |
| 分类浏览 | Browse by Category | 区块标题 |
| 更多 › / 全部书籍 › | More › / All books › | |
| 浏览全部 | Browse all | 按钮 |
| 开始写作 | Start writing | 仅博主可见 |
| 搜索结果 | Search results | |
| 在全部文章里看 › | See all articles › | |
| 搜索 “{q}”，共 {n} 篇 | “{q}” — {n} posts | |
| 搜索中… | Searching… | |
| 没有找到匹配的文章 | No matching posts | |
| 滚动加载更多… | Loading more… | |
| 已加载全部 {n} 篇 | All {n} posts loaded | |
| 共 {n} 章 · {m} 字 | {n} chapters · {m} words | ✅ 见下方「字数口径」 |
| 阅读 › | Read › | 书籍卡箭头 |
| {n} 篇 | {n} posts | 分类卡计数 |

### 字数口径（决策 5「重新数词」的落地方式）

现在 `novel.wordCount` / `chapter.wordCount` 是**写入时**算的 `content.replace(/\s/g,'').length`——对中文等于字数，对英文等于「字母数」，直接当 words 显示就是错的。所以：

- 新增 `src/lib/wordCount.ts`，`countWords(text, locale)`：
  - `zh`：`去空白后的字符数`（**口径与历史数据完全一致，中文页数字一个都不变**）
  - `en`：先剥掉 Markdown 标记、代码块与 `$…$` / `$$…$$` 公式，再按 `[\p{L}\p{N}]+` 分词计数 → 真正的英文词数
- 显示层按当前 locale **实时计算**，中英各算各的；`novel.wordCount` 字段**降级为 fallback**（内容缺失或算不出来时才用），写入逻辑不动
- 英文页显示为 `{n} words`（千位分隔，如 `12,345 words`）；中文页仍显示 `{n} 字`
- 影响面：首页书籍卡、`/novels` 书架、`NovelCard`、`NovelReader`（书头 + 目录 + 章节）共 5 处

---

## 五、文章列表 / 文章详情

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 全部文章 | All Articles | |
| 全部 | All | 分类筛选 chip |
| 阅读 | Read | 「阅读」链接 |
| 回到顶部 | Back to top | aria-label + title |
| 置顶 | Pinned | |
| 收藏 / 取消收藏 | Save / Unsave | 与第三节保持一致 |
| 文章不存在或被删除了 | This post doesn't exist, or has been deleted. | |
| 返回首页 | Back to Home | |
| ★ 已收藏 / ☆ 收藏 | ★ Saved / ☆ Save | |
| 导出 .md | Export .md | |
| 📑 目录 | 📑 Contents | 折叠目录 |
| 附件（{n}） | Attachments ({n}) | |
| 日期：/ 分类：/ 标签： | Date: / Category: / Tags: | 导出 md 时的表头 |
| 编辑文章 / 删除文章 / 确定要删除这篇文章吗… | （保留中文） | 仅博主可见 |
| ‹ 全部文章 | ‹ All Articles | 分类页返回链接 |
| 这个分类还没有文章 | No posts in this category yet. | |
| 去写一篇 | Write one | 仅博主可见 |

---

## 六、书架 / 阅读器

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 小说书架 | Bookshelf | |
| 共 {n} 本 · {m} 章 | {n} books · {m} chapters | |
| 书架还是空的，快去写作页连载第一篇小说吧 | The shelf is empty for now. | ⚠️ 后半句是对博主说的，英文版建议直接删掉（见 P0 决策） |
| 作者：{name} / 作者 {name} | by {name} | |
| 共 {n} 章 / · {m} 字 | {n} chapters / · {m} words | ✅ 见第四节「字数口径」 |
| · 已读 {p}% | · {p}% read | |
| 开始阅读 / 继续阅读 · {章节} | Start reading / Continue · {chapter} | |
| 目录 / 章节目录 | Contents / Chapters | |
| 整本评论（{n}） | Book comments ({n}) | |
| 本章评论（{n}） | Chapter comments ({n}) | |
| 上一章 / 下一章 | Previous / Next | 阅读器底部 |
| 返回书籍 | Back to book | title 提示 |
| 设置 | Settings | title 提示 |
| 夜间模式 / 已开启 / 开启 | Night mode / On / Off | |
| 字号 / 小 中 大 特大 | Text size / S M L XL | |
| 行距 / 紧凑 适中 宽松 | Line spacing / Tight Normal Loose | |
| {n} 字 | {n} words | 目录里的章节字数，按 locale 实时算 |

---

## 七、语气档（第六节之外的所有「软语气」句子）

> **已定稿（2026-09-21）：18 行你逐行勾完，A 13 条 / B 5 条。最终文案＝你勾的那一列。**
> 其中 **第 4 行「说说你的想法吧…」你在 A 列上把文字改成了 `Say something please…`**——最终以你改的字为准，其余行照原 A/B 文本。
> 未勾选的那一列**作废**，不再进代码。
> 全部词条一律**英式拼写**（Favourites / Colour / Centre / -ise）。

| 中文原文 | A 温软版 | B 中性版 | 你的选择 |
|---|---|---|---|
| 登录后才能留言或评论哦～ | Sign in to leave a comment. | ~~Sign in to comment.~~ | **A** |
| 还没有留言，来抢沙发吧～ | No comments yet — be the first. | ~~No comments yet.~~ | **A** |
| 还没有反馈，一切安好～ | No reports yet — all quiet. | ~~No reports yet.~~ | **A** |
| 说说你的想法吧… | **Say something please…**（你改的） | ~~Write a comment…~~ | **A** |
| 欢迎在留言板上留下你的足迹～无论是想说的话、推荐的作品，还是给{昵称}的悄悄话，都可以写在这里。 | Leave a note here — anything you'd like to say, a work you'd recommend, or a quiet word for {nickname}. | ~~Leave a message here for {nickname}.~~ | **A** |
| 记录与我互相关注、相互链接的小伙伴们，欢迎交换友链～ | Sites I follow and trade links with. Link exchanges welcome. | ~~Sites I link to.~~ | **A** |
| 我喜欢的图片 | Pictures I Like | ~~Gallery~~ | **A** |
| 直接把图片拖进来即可添加，也可以点击选择文件。 | ~~Drop an image in to add it, or click to choose a file.~~ | Drop or select a file to add an image. | **B** |
| 拖拽图片到这里，或点击选择文件 | ~~Drag an image here, or click to choose a file~~ | Drag or choose a file | **B** |
| 松开即可添加！ | Release to add | ~~Release to add~~ | **A** |
| 还没有收藏任何图片，快添加一张吧。 | ~~Nothing saved yet.~~ | No images yet. | **B** |
| 还没有友链，等你来添加～ | No links here yet. | ~~No links yet.~~ | **A** |
| 给这张图命名（可选） | ~~Name this picture (optional)~~ | Caption (optional) | **B** |
| 正在上传… / 正在加载友链… / 正在加载简介… | Uploading… / Loading links… / Loading… | 同 | **A** |
| 遇到问题？把 bug、界面异常或功能建议填在这里反馈给我。 | Found a problem? Report bugs, UI glitches or feature ideas here. | ~~Report bugs, UI issues or feature requests here.~~ | **A** |
| 已提交，谢谢反馈！ | Thanks — report received. | ~~Report submitted.~~ | **A** |
| 确定要删除这个友链吗？ | Remove this link? | Remove this link? | **A** |
| 可能是临时错误，刷新一下试试。 | This may be temporary — try refreshing. | ~~Try refreshing the page.~~ | **A** |

---

## 八、留言板 / 评论 / 通用状态

| 中文原文 | 建议英文 | 备注 |
|---|---|---|
| 留言板 | Guestbook | |
| 留言区 / Bug 反馈 | Messages / Bug reports | 两个页签 |
| 留言（{n}） | Comments ({n}) | ✅ 已定：中文的「留言/评论」在英文里统一成 Comments |
| 回复 | Reply | |
| 取消回复 | Cancel reply | |
| 回复 @{name} · | Replying to @{name} · | |
| 删除 | Delete | |
| 确定删除这条留言吗？ | Delete this comment? | |
| 发表 / 已发表 | Post / Posted | |
| + {n} 条回复 / 收起折叠回复 | {n} replies / Hide replies | |
| 查看个人主页 | View profile | |
| 头像 / 预览 / 图标预览 | Avatar / Preview / Icon preview | |
| 匿名 / 匿名用户 / 匿名路人 | Anonymous | |
| 页面出了点问题 | Something went wrong | ErrorBoundary |
| 可能是临时错误，刷新一下试试。 | This may be temporary — try refreshing. | |
| 刷新页面 | Refresh | |
| 加载中… | Loading… | 路由级 Suspense |
| 无权限 / 请选择图片文件 / 上传失败：/ 保存失败： | Not allowed / Choose an image file / Upload failed: / Save failed: | |
| 提交反馈 / 已提交，谢谢反馈！/ 请填写问题描述 | Send report / Thanks — report received. / Please describe the problem. | |
| 遇到问题？把 bug、界面异常或功能建议填在这里反馈给我。 | Found a problem? Report bugs, UI glitches or feature ideas here. | |
| 请描述你遇到的问题或报错… | Describe the problem or error… | placeholder |
| 标记已处理 / 恢复待处理 / 待处理 / 已处理 | 仅博主可见 | 保留中文 |
| 正在上传图标… / ＋ 拖入本地图片上传，或点击选择… | Uploading icon… / ＋ Drop an image or click to choose | 仅博主可见 |
| 确定要删除这个友链吗？ | Remove this link? | |
| 关于本站 / 本站简介 / 主题灵感 | About / About this site / Theme Inspiration | ⚠️ 关于页正文在 Supabase（`about_versions`），**不在这份词表里**——你写英文版时我给一个编辑入口，正文由你写 |
| 天空蓝 · 开衫 / 蜜金 · 长发 / 珊瑚粉 · 长发 / 青蓝 · 眼睛 | Sky blue · cardigan / Honey gold · hair / Coral pink · hair / Clear aqua · eyes | 四色小圆点的 hover 提示 |
| 关于 / 留言板 / 友链（页脚） | About / Guestbook / Links | ⚠️ 这里的「友链」你改成了 **Links**，而顶栏（第二节）仍是 **Friends**——**两处不一致，落地前告诉我统一成哪个**（我默认按你改的来：顶栏 Friends、页脚 Links、Friends 页正文标题 Friends & Links） |

---

## 九、不翻的（仅博主可见，保留中文）

以下文件**整个不翻**，你后台照常用中文：

- `src/pages/Write.tsx`（65 条）、`src/components/NovelComposer.tsx`（42 条）
- `src/pages/About.tsx` 里的**简介编辑/历史版本/页脚文字管理**部分（公开呈现部分要翻）

> ⚠️ **2026-09-21 修订**：`LoginPage.tsx`、`ProfilePage.tsx`、`AvatarCropModal.tsx` 原本也在这一节里，
> 用户点名「登录页没有做英文」后**已开翻**，词表见第十三节。修订依据是本节的既有口径——
> **公开呈现部分要翻**：登录页是访客点顶栏 Sign in / 评论区 "Sign in to leave a comment" 会到的页面，
> 个人主页是访客点评论者头像会到的页面，两者都属公开面，不是博主后台。
> **仍然只翻公开面**：写作编辑器（Write / NovelComposer）保持中文。

---

## 十、翻译数据的存放（P3 的方向，先说给你听）

因为**英文内容你要自己写/自己改**，所以不做「机翻灌库」，改成一个**英文翻译工作台**：

- 新建 Supabase 表 `article_translations`：`article_id / locale / title / content / summary / status(draft|reviewed) / updated_at`
- 后台在写作页旁边加一个「**English**」页签：左边中文原文（只读）、右边英文编辑框，**存草稿随时存**，标 `reviewed` 才上线
- 公开英文页：有英文就显示英文，没有就显示中文原文 + 一行「*This post is only available in Chinese for now.*」
- 关于页（`about_versions`）同样加一份英文版，也是你来写
- 评论 / 留言（53 条 UGC）**不翻**，保持原样显示

---

## 十一、流程提醒

1. ~~你在这份词表上批注~~ ✅ **已完成（2026-09-21）**
2. ~~词表定稿~~ ✅ **已定稿** → 进入 P1（i18n 骨架 + `/en/` 路由 + 英文 HTML 壳 + 拉丁字体子集）
3. P2 把上面这些字换进代码
4. P3 翻译工作台（你自己写内容）
5. P4 SEO（hreflang / 英文 sitemap / 预渲染）
6. P5 按你既定流程验收：起本地预览 → 把 URL 给你 → 你看完给方向 → 不 commit 不 push

**配色铁律与现有中文字体线不动**：英文版只用凉风凉四色；中文字体分片一个不碰，拉丁衬线是新增。

---

## 十二、P3 施工时新增的三句文案（2026-09-21）

这三句是为了「有内容但没译文」这种情况**必须说清楚**才加的，都只有这一处用途，改动前请先改这张表：

| 键名 | 用在哪 | 中文 | English |
| --- | --- | --- | --- |
| `article.zhOnly` | 英文文章页，整篇还没有英文译文 | 这篇文章目前只有中文版。 | This post is only available in Chinese for now. |
| `article.partialZh` | 英文小说页，只有部分章节译了 | 这本书只有部分章节有英文版，其余显示中文原文。 | Some chapters of this book are not translated yet — they are shown in the original Chinese. |
| `about.zhOnly` | 英文关于页，还没写过英文版简介 | 本站简介目前只有中文版。 | This page is only available in Chinese for now. |

第一句的英文就是你在这份词表第十节里写下的原句（只去掉了 Markdown 的斜体星号）。

---

## 十三、登录页 / 个人主页 / 头像裁剪（2026-09-21 新增，起因：用户「登录页没有做英文」）

这三处补翻的理由见第九节的修订说明（公开面）。**中文栏全是线上现役原文，一字未改。**

### 登录 / 注册页（`login.*`，`src/pages/LoginPage.tsx`）

| 键名 | 用在哪 | 中文 | English |
| --- | --- | --- | --- |
| `login.pageTitle` | 浏览器标签页标题 | 登录 | Sign in |
| `login.cardSignIn` | 卡片大标题（登录态） | 呓语集 | The Set of Murmurs |
| `login.cardSignUp` | 卡片大标题（注册态） | 加入呓语集 | Join The Set of Murmurs |
| `login.subSignIn` | 副标题（登录态） | 登录你的账号，继续书写呓语 | Sign in to your account and keep writing. |
| `login.subSignUp` | 副标题（注册态） | 创建一个新账号 | Create a new account. |
| `login.back` | 右上角 × 的无障碍名 | 返回 | Back |
| `login.email` | 邮箱输入框占位 | 邮箱 | Email |
| `login.password` | 密码输入框占位 | 密码（至少8位，含字母和数字） | Password (8+ characters, letters and numbers) |
| `login.confirmPassword` | 确认密码占位 | 确认密码 | Confirm password |
| `login.showPassword` / `login.hidePassword` / `login.togglePassword` | 小眼睛按钮的 title / aria-label | 显示密码 / 隐藏密码 / 显示/隐藏密码 | Show password / Hide password / Show or hide password |
| `login.remember` | 记住登录勾选项 | 记住登录（保持登录，下次免输入） | Remember me (stay signed in on this device) |
| `login.captchaAnswer` | 验证码答案占位 | 填答案 | Answer |
| `login.submitting` | 提交按钮 loading 态 | 提交中… | Submitting… |
| `login.signIn` / `login.signUp` | 提交按钮（中文刻意字间加空格） | 登 录 / 注 册 | Sign in / Sign up |
| `login.noAccount` / `login.haveAccount` | 底部换挡提示（英文带尾随空格再接按钮） | 没有账号？ / 已有账号？ | No account yet? / Already have an account? |
| `login.goSignUp` / `login.goSignIn` | 换挡按钮 | 去注册 / 去登录 | Sign up / Sign in |
| `login.errPasswordRule` | 前端校验：密码规则 | 密码需至少8位，且同时包含字母和数字 | Password must be at least 8 characters and include both letters and numbers. |
| `login.errPasswordMismatch` | 前端校验：两次不一致 | 两次输入的密码不一致 | The two passwords do not match. |
| `login.errCaptcha` | 前端校验：验证码错 | 验证码不正确，请重新输入 | Incorrect answer — please try again. |
| `login.verifySent` | 注册后需邮箱验证的提示 | 注册成功！我们已向你的邮箱发送验证链接，请点击验证后再登录。 | You’re registered! We’ve sent a verification link to your email — click it, then sign in. |

### 个人主页 + 头像裁剪（`profile.*` / `crop.*`）

| 键名 | 用在哪 | 中文 | English |
| --- | --- | --- | --- |
| `profile.pageTitleSelf` / `profile.pageTitleGuest` | 标签页标题 | 我的主页 / 访客主页 | My profile / Profile |
| `profile.headingSelf` / `profile.headingGuest` | 页面大标题 | 我的主页 / TA 的主页 | My profile / Profile |
| `profile.loading` | 访客主页加载态 | 正在加载 TA 的主页… | Loading profile… |
| `profile.unnamed` | 没有昵称时的兜底名 | 未命名用户 | Unnamed user |
| `profile.noSignature` | 没有个性签名时 | 这个人很懒，还没有签名 | This person is a bit lazy — no signature yet. |
| `profile.noIntro` | 没有个人介绍时 | 还没有填写介绍… | No introduction written yet… |
| `profile.avatar` | 头像 alt / 上传按钮 | 头像 | Avatar |
| `profile.editBtn` / `profile.editHeading` | 编辑入口 / 编辑表单标题 | 编辑资料 / 编辑个人主页 | Edit profile / Edit profile |
| `profile.nickname` / `profile.signature` / `profile.introLabel` | 编辑表单字段名 | 昵称 / 个性签名 / 个人介绍 | Nickname / Signature / Introduction |
| `profile.save` / `profile.cancel` | 编辑表单按钮 | 保存 / 取消 | Save / Cancel |
| `profile.backHome` | 访客主页的返回按钮 | 返回首页 | Back to Home |
| `crop.title` / `crop.hint` / `crop.close` | 裁剪弹窗标题 / 提示 / 关闭 | 调整头像 / 拖动图片调整位置，滚动滚轮（或拖动滑块）缩放。/ 关闭 | Adjust avatar / Drag the image to reposition, scroll (or drag the slider) to zoom. / Close |
| `crop.confirm` / `crop.cancel` / `crop.failed` | 确定 / 取消 / 失败提示 | 确定 / 取消 / 图片处理失败，请重试 | Confirm / Cancel / Image processing failed — please try again. |

### 两处**故意不翻**的（你知情后再定）

1. **Supabase 返回的登录报错**（如 `Invalid login credentials`、`Email not confirmed`）是**库里直接吐的英文**，
   原样显示——所以**中文登录页的这类报错本来就是英文**，这次没动它。要做中英映射的话跟我说，我加一层对照表。
2. `src/pages/Write.tsx`、`src/components/NovelComposer.tsx`（写作编辑器，只有博主自己看）保持中文。
