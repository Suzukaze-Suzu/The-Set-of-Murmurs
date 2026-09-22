// ============================================================================
// 呓语集 · 中英文案字典
// ----------------------------------------------------------------------------
// 设计：**一门语言一条目、两种语言并排**，键名共用。
//   · 中英不会各写一份字典导致键漂移；一条中文文案对应哪句英文，就在同一行。
//   · 英文的词数/复数变化用 { one, other } 形式，t() 按 {n} 自动选。
//     一句话里**两个数字都要变形**时用内联形式 `{m:chapter|chapters}`（2026-09-22 追加，
//     见 i18n/index.tsx 的 translate()）——{one,other} 只认 `n`，写不了「1 book · 2 chapters」。
//   · 内容全部来自 blog/docs/i18n-strings.md（Saber 2026-09-21 定稿），
//     改措辞请**先改词表再改这里**，两边保持一致。
//   · ⚠️ 中文栏是**线上现役文案的原文**，不改一个字（改了＝静默回归中文站）。
//     同一功能在不同位置中文用词不同时（顶栏「留言」/ 页脚「留言板」）必须各自一键。
//
// 拼写口径：**英式**（Favourites / Colour / Centre / -ise）——Saber 定的。
// 语气口径：软语气句按词表第七节逐行勾选的结果（未勾的 B 版已作废）。
// ============================================================================

import type { Category } from '../types';

export type Plural = { one: string; other: string };
export type Entry = string | Plural;

export type Dict = Record<string, { zh: Entry; en: Entry }>;

export const dict: Dict = {
  // ---- 品牌与站点级（词表 一） ----
  'brand.short': { zh: '呓语集', en: 'Murmurs' },
  'brand.full': { zh: '呓语集', en: 'The Set of Murmurs' },
  'brand.tagline': { zh: '未知的梦话与胡言乱语', en: 'Dreams half-known, words unaccounted for' },
  'brand.intro': {
    zh: '这里是呓语集，会记录一些不自知的情绪和严谨的呓语',
    en: 'This is The Set of Murmurs — a place for unfelt feelings and grave murmurs.',
  },
  'brand.description': {
    zh: '呓语集 - 记录动漫、随想、读后感与数学学习的个人博客',
    en: 'The Set of Murmurs — a personal blog on anime, essays, reading notes and mathematics.',
  },
  'brand.footerCaption': { zh: '未知的梦话与胡言乱语', en: 'Dreams half-known, words unaccounted for' },
  // 页面标题的分隔符：中文沿用原来的 ' - '（不改中文站行为），英文按词表用 ' · '
  'brand.titleSep': { zh: ' - ', en: ' · ' },

  // ---- 导航（词表 二） ----
  'nav.home': { zh: '首页', en: 'Home' },
  'nav.articles': { zh: '文章', en: 'Articles' },
  'nav.bookshelf': { zh: '书架', en: 'Bookshelf' },
  'nav.gallery': { zh: '图集', en: 'Gallery' },
  'nav.guestbook': { zh: '留言', en: 'Guestbook' },
  'nav.friends': { zh: '友链', en: 'Friends' },
  'nav.about': { zh: '关于', en: 'About' },
  'nav.categories': { zh: '分类', en: 'Categories' },
  'nav.browseCategories': { zh: '分类浏览', en: 'Categories' },
  'nav.search': { zh: '全文搜索', en: 'Search' },
  'nav.searchPlaceholder': { zh: '全文搜索文章…', en: 'Search posts…' },
  'nav.searchPlaceholderEsc': { zh: '全文搜索文章…（Esc 关闭）', en: 'Search posts… (Esc to close)' },
  'nav.clearSearch': { zh: '清除搜索词', en: 'Clear search' },
  'nav.openMenu': { zh: '打开菜单', en: 'Open menu' },
  'nav.closeMenu': { zh: '关闭菜单', en: 'Close menu' },
  'nav.menu': { zh: '菜单', en: 'Menu' },
  'nav.lightMode': { zh: '切换亮色', en: 'Light mode' },
  'nav.darkMode': { zh: '切换暗色', en: 'Dark mode' },
  'nav.switchTheme': { zh: '切换主题', en: 'Switch theme' },
  'nav.travellings': { zh: '开往-友链接力', en: 'Travellings' },
  'nav.travellingsTitle': { zh: '开往-友链接力', en: 'Travellings — a Chinese webring' },
  'nav.signIn': { zh: '登录', en: 'Sign in' },
  'nav.signOut': { zh: '退出登录', en: 'Sign out' },
  'nav.account': { zh: '账号', en: 'Account' },
  'nav.author': { zh: '博主', en: 'Author' },
  'nav.myProfile': { zh: '个人主页', en: 'My profile' },
  'nav.write': { zh: '写作', en: 'Write' },
  'nav.footerLinks': { zh: '友链', en: 'Links' },
  // 页脚的「留言板」和顶栏的「留言」在中文里是两个词，英文都是 Guestbook。
  // 单独给一键，避免把中文站页脚原本的「留言板」改掉。
  'nav.footerGuestbook': { zh: '留言板', en: 'Guestbook' },

  // ---- 分类名与状态签（词表 三） ----
  'cat.anime': { zh: '读后感', en: 'Impressions' },
  'cat.essay': { zh: '随笔', en: 'Essays' },
  'cat.reading': { zh: '小说', en: 'Fiction' },
  'cat.math': { zh: '数学笔记', en: 'Math Notes' },
  'cat.study': { zh: '学习分享', en: 'Study Notes' },
  // ⚠️ 键名的后缀必须与**数据里的真实取值**一致（types/index.ts 的 NOVEL_STATUS_META：
  //    serializing / completed / paused），不能按中文语义自己起名——踩过：
  //    原来写成 cat.ongoing，结果中文书架页直接把 "cat.serializing" 这个键名漏在了界面上。
  'cat.serializing': { zh: '连载中', en: 'Ongoing' },
  'cat.completed': { zh: '已完结', en: 'Completed' },
  'cat.paused': { zh: '暂停更新', en: 'On hold' },
  'cat.pinned': { zh: '置顶', en: 'Pinned' },
  'cat.save': { zh: '收藏', en: 'Save' },
  'cat.unsave': { zh: '取消收藏', en: 'Unsave' },
  'cat.new': { zh: '最新', en: 'New' },
  'cat.bug': { zh: 'Bug 报错', en: 'Bug' },
  'cat.ui': { zh: '界面问题', en: 'UI issue' },
  'cat.feature': { zh: '功能建议', en: 'Feature request' },
  'cat.other': { zh: '其他', en: 'Other' },

  // ---- 首页（词表 四） ----
  'home.latestUpdates': { zh: '最新更新', en: 'Latest Updates' },
  'home.pinnedSaved': { zh: '置顶与收藏', en: 'Pinned & Saved' },
  'home.bookUpdates': { zh: '书籍更新', en: 'Book Updates' },
  'home.browseByCategory': { zh: '分类浏览', en: 'Browse by Category' },
  'home.more': { zh: '更多', en: 'More' },
  'home.allBooks': { zh: '全部书籍', en: 'All books' },
  'home.browseAll': { zh: '浏览全部', en: 'Browse all' },
  'home.startWriting': { zh: '开始写作', en: 'Start writing' },
  'home.searchResults': { zh: '搜索结果', en: 'Search results' },
  'home.seeAllArticles': { zh: '在全部文章里看', en: 'See all articles' },
  'home.newTag': { zh: '最新', en: 'New' },
  'home.titleSearch': { zh: '搜索：{q}', en: 'Search: {q}' },

  // ---- 搜索与列表（首页与「全部文章」共用，故不放在 home 下） ----
  'search.prefix': { zh: '搜索 “', en: '“' },
  'search.suffix': { zh: '”，共 {n} 篇', en: '” — {n} posts' },
  'search.suffixIng': { zh: '”，搜索中…', en: '” — searching…' },
  'search.searching': { zh: '搜索中…', en: 'Searching…' },
  'search.noMatch': { zh: '没有找到匹配的文章', en: 'No matching posts' },

  // ---- 数字与计数（多个页面共用） ----
  'count.posts': { zh: '{n} 篇', en: { one: '{n} post', other: '{n} posts' } },
  'count.chapters': { zh: '共 {n} 章', en: { one: '{n} chapter', other: '{n} chapters' } },
  'count.chaptersWords': { zh: '共 {n} 章 · {m}', en: '{n:chapter|chapters} · {m}' },
  'count.words': { zh: '{n} 字', en: { one: '{n} word', other: '{n} words' } },
  /* ★ 2026-09-22：「{m} 字」里的 {m} 改成由 lib/wordCount.ts 的 countLabel() 先算好
     （中文站＝`707 字`，所以输出与改动前逐字相同；英文站可能是 `707 words` /
     `6,765 characters` / `447 words · 6,765 characters` 三种，见那里的说明）。
     下面 count.chars 是英文站「中文正文按字数说」时的单位（character / characters）。 */
  'count.chars': { zh: '{n} 字', en: { one: '{n} character', other: '{n} characters' } },
  'count.booksChapters': { zh: '共 {n} 本 · {m} 章', en: '{n:book|books} · {m:chapter|chapters}' },
  'count.loadingMore': { zh: '滚动加载更多…', en: 'Loading more…' },
  'count.allLoaded': { zh: '已加载全部 {n} 篇', en: 'All {n} posts loaded' },

  // ---- 文章列表 / 详情（词表 五） ----
  'article.all': { zh: '全部文章', en: 'All Articles' },
  'article.filterAll': { zh: '全部', en: 'All' },
  'article.read': { zh: '阅读', en: 'Read' },
  'article.backToTop': { zh: '回到顶部', en: 'Back to top' },
  'article.notFound': { zh: '文章不存在或被删除了', en: "This post doesn't exist, or has been deleted." },
  'article.backHome': { zh: '返回首页', en: 'Back to Home' },
  'article.savedStar': { zh: '★ 已收藏', en: '★ Saved' },
  'article.saveStar': { zh: '☆ 收藏', en: '☆ Save' },
  'article.exportMd': { zh: '导出 .md', en: 'Export .md' },
  'article.contents': { zh: '📑 目录', en: '📑 Contents' },
  'article.attachments': { zh: '附件（{n}）', en: 'Attachments ({n})' },
  // 导出 .md 的表头（跟着当前语言走）
  'article.mdDate': { zh: '日期：', en: 'Date: ' },
  'article.mdCategory': { zh: '分类：', en: 'Category: ' },
  'article.mdTags': { zh: '标签：', en: 'Tags: ' },
  'article.backToAll': { zh: '‹ 全部文章', en: '‹ All Articles' },
  'article.noneInCategory': { zh: '这个分类还没有文章', en: 'No posts in this category yet.' },
  'article.writeOne': { zh: '去写一篇', en: 'Write one' },
  'article.pinnedTitle': { zh: '置顶', en: 'Pinned' },
  // P3 翻译工作台（2026-09-21）：英文页缺译时的两行提示。
  // 词表原话（docs/i18n-strings.md 第十节）：这篇没有英文时显示中文原文 + 一行
  // 「*This post is only available in Chinese for now.*」——英文栏原样照抄，只去掉 Markdown 斜体标记。
  'article.zhOnly': {
    zh: '这篇文章目前只有中文版。',
    en: 'This post is only available in Chinese for now.',
  },
  // 小说只有部分章节有英文时（逐章回退中文），说清楚是哪一种，别让人以为整本都译了
  'article.partialZh': {
    zh: '这本书只有部分章节有英文版，其余显示中文原文。',
    en: 'Some chapters of this book are not translated yet — they are shown in the original Chinese.',
  },

  // ---- 书架 / 阅读器（词表 六） ----
  'shelf.title': { zh: '小说书架', en: 'Bookshelf' },
  'shelf.summary': { zh: '共 {n} 本 · {m} 章', en: '{n:book|books} · {m:chapter|chapters}' },
  'shelf.empty': { zh: '书架还是空的，快去写作页连载第一篇小说吧', en: 'The shelf is empty for now.' },
  'shelf.byAuthor': { zh: '作者：{name}', en: 'by {name}' },
  'shelf.chaptersCount': { zh: '共 {n} 章', en: { one: '{n} chapter', other: '{n} chapters' } },
  'shelf.partOfChapters': { zh: '共 {n} 章', en: { one: '· {n} chapter', other: '· {n} chapters' } },
  'shelf.readPct': { zh: '· 已读 {p}%', en: '· {p}% read' },
  'shelf.startReading': { zh: '开始阅读', en: 'Start reading' },
  'shelf.continueReading': { zh: '继续阅读 · {title}', en: 'Continue · {title}' },
  'shelf.contents': { zh: '目录', en: 'Contents' },
  'shelf.chaptersTitle': { zh: '章节目录', en: 'Chapters' },
  'shelf.bookComments': { zh: '整本评论（{n}）', en: 'Book comments ({n})' },
  'shelf.chapterComments': { zh: '本章评论（{n}）', en: 'Chapter comments ({n})' },
  'shelf.prevChapter': { zh: '上一章', en: 'Previous' },
  'shelf.nextChapter': { zh: '下一章', en: 'Next' },
  'shelf.backToBook': { zh: '返回书籍', en: 'Back to book' },
  'shelf.settings': { zh: '设置', en: 'Settings' },
  'shelf.nightMode': { zh: '夜间模式', en: 'Night mode' },
  'shelf.on': { zh: '已开启', en: 'On' },
  'shelf.off': { zh: '开启', en: 'Off' },
  'shelf.textSize': { zh: '字号', en: 'Text size' },
  'shelf.lineSpacing': { zh: '行距', en: 'Line spacing' },
  'shelf.loose': { zh: '宽松', en: 'Loose' },
  'shelf.tight': { zh: '紧凑', en: 'Tight' },
  'shelf.normal': { zh: '适中', en: 'Normal' },
  'shelf.sizeS': { zh: '小', en: 'S' },
  'shelf.sizeM': { zh: '中', en: 'M' },
  'shelf.sizeL': { zh: '大', en: 'L' },
  'shelf.sizeXL': { zh: '特大', en: 'XL' },
  'shelf.wordsOnly': { zh: '{n} 字', en: { one: '{n} word', other: '{n} words' } },

  // ---- 图集（词表 七） ----
  'gallery.title': { zh: '图集', en: 'Gallery' },
  'gallery.heading': { zh: '我喜欢的图片', en: 'Pictures I Like' },
  'gallery.desc': {
    zh: '直接把图片拖进来即可添加，也可以点击选择文件。',
    en: 'Drop or select a file to add an image.',
  },
  'gallery.dropHint': { zh: '拖拽图片到这里，或点击选择文件', en: 'Drag or choose a file' },
  'gallery.releaseToAdd': { zh: '松开即可添加！', en: 'Release to add' },
  'gallery.captionPlaceholder': { zh: '给这张图命名（可选）', en: 'Caption (optional)' },
  'gallery.addImage': { zh: '添加图片', en: 'Add image' },
  'gallery.uploading': { zh: '正在上传…', en: 'Uploading…' },
  'gallery.empty': { zh: '还没有收藏任何图片，快添加一张吧。', en: 'No images yet.' },
  'gallery.unnamed': { zh: '未命名图片', en: 'Untitled' },
  'gallery.imageAlt': { zh: '图片', en: 'Image' },
  'gallery.preview': { zh: '预览', en: 'Preview' },
  'gallery.remove': { zh: '移除', en: 'Remove' },
  'gallery.removeTitle': { zh: '移除这张图片', en: 'Remove this image' },
  'gallery.wrongType': { zh: '请拖入图片文件（jpg/png/gif 等）', en: 'Please drop an image file (jpg/png/gif …)' },
  'gallery.pickOne': { zh: '请选择或拖入一张图片', en: 'Choose or drop an image' },

  // ---- 友链（词表 七 / 八） ----
  'friends.title': { zh: '友链', en: 'Friends' },
  'friends.heading': { zh: '友情链接', en: 'Friends & Links' },
  'friends.desc': {
    zh: '记录与我互相关注、相互链接的小伙伴们，欢迎交换友链～',
    en: 'Sites I follow and trade links with. Link exchanges welcome.',
  },
  'friends.none': { zh: '还没有友链，等你来添加～', en: 'No links here yet.' },
  'friends.loading': { zh: '正在加载友链…', en: 'Loading links…' },
  'friends.removeConfirm': { zh: '确定要删除这个友链吗？', en: 'Remove this link?' },
  'friends.add': { zh: '＋ 添加友链', en: '＋ Add link' },
  'friends.edit': { zh: '编辑友链', en: 'Edit link' },
  'friends.siteName': { zh: '站点名称 *', en: 'Site name *' },
  'friends.siteUrl': { zh: '网址 *', en: 'URL *' },
  'friends.siteDesc': { zh: '一句话描述（可选）', en: 'One-line description (optional)' },
  'friends.siteDescPlaceholder': { zh: '用一句话介绍这个站点', en: 'Describe this site in one line' },
  'friends.icon': { zh: '图标（可选）· 拖入本地图片上传，或点击选择', en: 'Icon (optional) · drop an image or click to choose' },
  'friends.iconDrop': { zh: '＋ 拖入本地图片上传，或点击选择', en: '＋ Drop an image or click to choose' },
  'friends.iconUploading': { zh: '正在上传图标…', en: 'Uploading icon…' },
  'friends.iconUrl': { zh: '图标图片地址（可选，不想上传时可直接填写）', en: 'Icon image URL (optional — fill in instead of uploading)' },
  'friends.iconPreview': { zh: '图标预览', en: 'Icon preview' },
  'friends.save': { zh: '保存', en: 'Save' },
  'friends.saving': { zh: '保存中…', en: 'Saving…' },
  'friends.cancel': { zh: '取消', en: 'Cancel' },
  'friends.editBtn': { zh: '编辑', en: 'Edit' },
  'friends.deleteBtn': { zh: '删除', en: 'Delete' },
  'friends.added': { zh: '友链已添加', en: 'Link added' },
  'friends.updated': { zh: '友链已更新', en: 'Link updated' },
  'friends.deleted': { zh: '友链已删除', en: 'Link removed' },
  'friends.saveFail': { zh: '操作失败，请重试', en: 'Something went wrong — please try again' },
  'friends.needNameUrl': { zh: '请填写站点名称和网址', en: 'Please fill in the site name and URL' },
  'friends.iconFail': { zh: '图标上传失败：', en: 'Icon upload failed: ' },
  'friends.iconErr': { zh: '图标上传异常：', en: 'Icon upload error: ' },

  // ---- 留言板 / 评论（词表 八） ----
  'comment.guestbookTitle': { zh: '留言板', en: 'Guestbook' },
  // 留言板欢迎语被一个 <a>昵称</a> 切开，所以拆成前后两截
  'comment.gbPrefix': {
    zh: '欢迎在留言板上留下你的足迹～无论是想说的话、推荐的作品，还是给',
    en: "Leave a note here — anything you'd like to say, a work you'd recommend, or a quiet word for ",
  },
  'comment.gbSuffix': { zh: '的悄悄话，都可以写在这里。', en: '.' },
  'comment.tabGuestbook': { zh: '留言区', en: 'Messages' },
  'comment.tabBug': { zh: 'Bug 反馈', en: 'Bug reports' },
  'comment.title': { zh: '留言（{n}）', en: 'Comments ({n})' },
  'comment.reply': { zh: '回复', en: 'Reply' },
  'comment.cancelReply': { zh: '取消回复', en: 'Cancel reply' },
  'comment.replyingTo': { zh: '回复 @{name} · ', en: 'Replying to @{name} · ' },
  'comment.delete': { zh: '删除', en: 'Delete' },
  'comment.deleteConfirm': { zh: '确定删除这条留言吗？', en: 'Delete this comment?' },
  'comment.post': { zh: '发表', en: 'Post' },
  'comment.posted': { zh: '已发表', en: 'Posted' },
  'comment.replies': { zh: '+ {n} 条回复', en: { one: '{n} reply', other: '{n} replies' } },
  'comment.hideReplies': { zh: '收起折叠回复', en: 'Hide replies' },
  'comment.viewProfile': { zh: '查看个人主页', en: 'View profile' },
  'comment.avatar': { zh: '头像', en: 'Avatar' },
  // 没头像时顶上的占位字：中文用「访」（访客），英文用名字首字母兜底 A
  'comment.avatarFallback': { zh: '访', en: 'A' },
  'comment.signInTip': { zh: '登录后才能留言或评论哦～', en: 'Sign in to leave a comment.' },
  'comment.saySomething': { zh: '说说你的想法吧…', en: 'Say something please…' },
  'comment.empty': { zh: '还没有留言，来抢沙发吧～', en: 'No comments yet — be the first.' },
  'comment.anonymous': { zh: '匿名路人', en: 'Anonymous' },

  // ---- Bug 反馈 ----
  'bug.heading': { zh: 'Bug 反馈 / 报错', en: 'Bug reports' },
  'bug.desc': {
    zh: '遇到问题？把 bug、界面异常或功能建议填在这里反馈给我。',
    en: 'Found a problem? Report bugs, UI glitches or feature ideas here.',
  },
  'bug.needLogin': { zh: '登录后才能提交反馈哦～', en: 'Sign in to send a report.' },
  'bug.placeholder': { zh: '请描述你遇到的问题或报错…', en: 'Describe the problem or error…' },
  'bug.submit': { zh: '提交反馈', en: 'Send report' },
  'bug.submitted': { zh: '已提交，谢谢反馈！', en: 'Thanks — report received.' },
  'bug.needContent': { zh: '请填写问题描述', en: 'Please describe the problem.' },
  'bug.empty': { zh: '还没有反馈，一切安好～', en: 'No reports yet — all quiet.' },
  'bug.anonymous': { zh: '匿名用户', en: 'Anonymous' },
  // 反馈状态存在数据库里时是中文（'待处理' / '已处理'），显示时按语言映射
  'bug.statusOpen': { zh: '待处理', en: 'Open' },
  'bug.statusDone': { zh: '已处理', en: 'Done' },
  'bug.markDone': { zh: '标记已处理', en: 'Mark as done' },
  'bug.markOpen': { zh: '恢复待处理', en: 'Reopen' },
  'bug.submitFailed': { zh: '提交失败：', en: 'Submit failed: ' },
  'bug.statusFailed': { zh: '状态更新失败：', en: 'Status update failed: ' },

  // ---- 关于页（公开部分） ----
  'about.title': { zh: '关于', en: 'About' },
  'about.heading': { zh: '关于本站', en: 'About' },
  'about.introTitle': { zh: '本站简介', en: 'About this site' },
  'about.loading': { zh: '正在加载简介…', en: 'Loading…' },
  'about.history': { zh: '历史版本({n})', en: 'History ({n})' },
  // P3：英文页还没写过英文版关于页时的提示（正文显示中文原文）
  'about.zhOnly': {
    zh: '本站简介目前只有中文版。',
    en: 'This page is only available in Chinese for now.',
  },
  'about.themeInspiration': { zh: '主题灵感', en: 'Theme Inspiration' },
  'about.skyBlue': { zh: '天空蓝 · 开衫', en: 'Sky blue · cardigan' },
  'about.honeyGold': { zh: '蜜金 · 长发', en: 'Honey gold · hair' },
  'about.coralPink': { zh: '珊瑚粉 · 长发', en: 'Coral pink · hair' },
  'about.aqua': { zh: '青蓝 · 眼睛', en: 'Clear aqua · eyes' },
  // 简介卡的「编辑」入口按钮：**跟着页面语言走**。
  // 2026-09-21 修正：原先是硬编码中文「编辑英文简介」，在 /en/about 上和英文的「History (7)」
  // 并排出现，用户当场问「编辑英文简介真的对吗」。按钮在页面正文区 → 归公开呈现，跟着页面语言；
  // 点开之后的编辑器内部（编辑/预览/保存并生成新版本）仍是中文，那是博主后台。
  'about.editIntro': { zh: '编辑简介', en: 'Edit the English intro' },
  'about.editProfile': { zh: '编辑个人资料', en: 'Edit profile' },
  'about.profileManage': { zh: '个人资料管理', en: 'Profile' },

  // ---- 通用状态（词表 八） ----
  'common.loading': { zh: '加载中…', en: 'Loading…' },
  'common.refresh': { zh: '刷新页面', en: 'Refresh' },
  'common.delete': { zh: '删除', en: 'Delete' },
  'common.reply': { zh: '回复', en: 'Reply' },
  'common.post': { zh: '发表', en: 'Post' },
  'common.posted': { zh: '已发表', en: 'Posted' },
  'common.anonymous': { zh: '匿名', en: 'Anonymous' },
  'common.avatar': { zh: '头像', en: 'Avatar' },
  'common.uploading': { zh: '正在上传…', en: 'Uploading…' },
  'common.notAllowed': { zh: '无权限', en: 'Not allowed' },
  'common.chooseImageFile': { zh: '请选择图片文件', en: 'Choose an image file' },
  'common.uploadFailed': { zh: '上传失败：', en: 'Upload failed: ' },
  'common.saveFailed': { zh: '保存失败：', en: 'Save failed: ' },
  'common.somethingWentWrong': { zh: '页面出了点问题', en: 'Something went wrong' },
  'common.temporaryTryRefresh': {
    zh: '可能是临时错误，刷新一下试试。',
    en: 'This may be temporary — try refreshing.',
  },

  // ---- 语气句（词表 七，逐行定稿） ----
  'tone.signInToComment': { zh: '登录后才能留言或评论哦～', en: 'Sign in to leave a comment.' },
  'tone.noComments': { zh: '还没有留言，来抢沙发吧～', en: 'No comments yet — be the first.' },
  'tone.saySomething': { zh: '说说你的想法吧…', en: 'Say something please…' },
  'tone.bugFeedbackDesc': {
    zh: '遇到问题？把 bug、界面异常或功能建议填在这里反馈给我。',
    en: 'Found a problem? Report bugs, UI glitches or feature ideas here.',
  },
  'tone.reportReceived': { zh: '已提交，谢谢反馈！', en: 'Thanks — report received.' },
  'tone.removeLinkConfirm': { zh: '确定要删除这个友链吗？', en: 'Remove this link?' },
  'tone.noLinks': { zh: '还没有友链，等你来添加～', en: 'No links here yet.' },
  'tone.noImages': { zh: '还没有收藏任何图片，快添加一张吧。', en: 'No images yet.' },
  'tone.captionOptional': { zh: '给这张图命名（可选）', en: 'Caption (optional)' },
  'tone.dropOrChoose': { zh: '拖拽图片到这里，或点击选择文件', en: 'Drag or choose a file' },
  'tone.releaseToAdd': { zh: '松开即可添加！', en: 'Release to add' },

  // ---- 登录 / 注册页（英文版新增，词表 十三；原属「不翻的」清单，2026-09-21 用户点名后开翻） ----
  // 这一页是**访客能碰到的**（顶栏 Sign in、评论「Sign in to leave a comment」都指向它），
  // 所以按词表九的口径「公开呈现部分要翻」处理；中文栏仍是一字未改的线上原文。
  'login.pageTitle': { zh: '登录', en: 'Sign in' },
  'login.cardSignIn': { zh: '呓语集', en: 'The Set of Murmurs' },
  'login.cardSignUp': { zh: '加入呓语集', en: 'Join The Set of Murmurs' },
  'login.subSignIn': { zh: '登录你的账号，继续书写呓语', en: 'Sign in to your account and keep writing.' },
  'login.subSignUp': { zh: '创建一个新账号', en: 'Create a new account.' },
  'login.back': { zh: '返回', en: 'Back' },
  'login.email': { zh: '邮箱', en: 'Email' },
  'login.password': { zh: '密码（至少8位，含字母和数字）', en: 'Password (8+ characters, letters and numbers)' },
  'login.confirmPassword': { zh: '确认密码', en: 'Confirm password' },
  'login.showPassword': { zh: '显示密码', en: 'Show password' },
  'login.hidePassword': { zh: '隐藏密码', en: 'Hide password' },
  'login.togglePassword': { zh: '显示/隐藏密码', en: 'Show or hide password' },
  'login.remember': { zh: '记住登录（保持登录，下次免输入）', en: 'Remember me (stay signed in on this device)' },
  'login.captchaAnswer': { zh: '填答案', en: 'Answer' },
  'login.submitting': { zh: '提交中…', en: 'Submitting…' },
  'login.signIn': { zh: '登 录', en: 'Sign in' },
  'login.signUp': { zh: '注 册', en: 'Sign up' },
  'login.noAccount': { zh: '没有账号？', en: 'No account yet? ' },
  'login.haveAccount': { zh: '已有账号？', en: 'Already have an account? ' },
  'login.goSignUp': { zh: '去注册', en: 'Sign up' },
  'login.goSignIn': { zh: '去登录', en: 'Sign in' },
  'login.errPasswordRule': { zh: '密码需至少8位，且同时包含字母和数字', en: 'Password must be at least 8 characters and include both letters and numbers.' },
  'login.errPasswordMismatch': { zh: '两次输入的密码不一致', en: 'The two passwords do not match.' },
  'login.errCaptcha': { zh: '验证码不正确，请重新输入', en: 'Incorrect answer — please try again.' },
  'login.verifySent': { zh: '注册成功！我们已向你的邮箱发送验证链接，请点击验证后再登录。', en: 'You’re registered! We’ve sent a verification link to your email — click it, then sign in.' },

  // ---- 个人主页（英文版新增，词表 十三） ----
  // 一半是公开的（评论头像点进来看到的「他/她的主页」），一半是博主自己的资料编辑；
  // 按词表九「公开呈现部分要翻」的口径，这页整体翻——页面不该半中半英。
  'profile.pageTitleSelf': { zh: '我的主页', en: 'My profile' },
  'profile.pageTitleGuest': { zh: '访客主页', en: 'Profile' },
  'profile.headingSelf': { zh: '我的主页', en: 'My profile' },
  'profile.headingGuest': { zh: 'TA 的主页', en: 'Profile' },
  'profile.loading': { zh: '正在加载 TA 的主页…', en: 'Loading profile…' },
  'profile.unnamed': { zh: '未命名用户', en: 'Unnamed user' },
  'profile.noSignature': { zh: '这个人很懒，还没有签名', en: 'This person is a bit lazy — no signature yet.' },
  'profile.noIntro': { zh: '还没有填写介绍…', en: 'No introduction written yet…' },
  'profile.avatar': { zh: '头像', en: 'Avatar' },
  'profile.editBtn': { zh: '编辑资料', en: 'Edit profile' },
  'profile.cancel': { zh: '取消', en: 'Cancel' },
  'profile.backHome': { zh: '返回首页', en: 'Back to Home' },
  'profile.editHeading': { zh: '编辑个人主页', en: 'Edit profile' },
  'profile.nickname': { zh: '昵称', en: 'Nickname' },
  'profile.signature': { zh: '个性签名', en: 'Signature' },
  'profile.introLabel': { zh: '个人介绍', en: 'Introduction' },
  'profile.save': { zh: '保存', en: 'Save' },

  // ---- 头像裁剪弹窗（英文版新增，词表 十三；入口在个人主页的资料编辑里） ----
  'crop.title': { zh: '调整头像', en: 'Adjust avatar' },
  'crop.hint': { zh: '拖动图片调整位置，滚动滚轮（或拖动滑块）缩放。', en: 'Drag the image to reposition, scroll (or drag the slider) to zoom.' },
  'crop.close': { zh: '关闭', en: 'Close' },
  'crop.confirm': { zh: '确定', en: 'Confirm' },
  'crop.cancel': { zh: '取消', en: 'Cancel' },
  'crop.failed': { zh: '图片处理失败，请重试', en: 'Image processing failed — please try again.' },

  // ---- 语言切换（英文版新增；按钮显示的是「切过去的语言」） ----
  // 值刻意做得极短：顶栏图标按钮只有 36×36，装不下 "English"。
  'locale.switch': { zh: 'EN', en: '中文' },
  'locale.switchTitle': { zh: 'Read in English', en: '用中文阅读' },
};

export type DictKey = keyof typeof dict;

/** 分类 → 字典键（供 t() 取分类名，替代 CATEGORY_META[c].label 的硬编码中文） */
export const catKey = (c: Category): DictKey => `cat.${c}` as DictKey;

/** 小说连载状态 → 字典键 */
export const novelStatusKey = (s: string): DictKey => `cat.${s}` as DictKey;
