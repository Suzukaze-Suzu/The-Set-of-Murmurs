// ⚠️ 本文件由 scripts/generate-site-snapshot.mjs 在构建时自动维护，不要手改。
//
// 内容＝上次构建那一刻「线上真实的站点文案」。用途：让首屏（以及断网/请求失败时）
// 直接渲染线上现在的文字，而不是 src 里写死的旧兜底文案。
// 取值优先级：localStorage 缓存 > 本快照 > 空字符串，见 src/lib/siteCache.ts。
// 数据没变化时构建不会重写本文件；改过线上文案后重新构建会更新它（记得一起提交）。

export interface SiteSnapshot {
  profile: { nickname: string; signature: string; intro: string };
  footer: { slogan: string; caption: string; copyright: string };
  about: string;
}

export const SITE_SNAPSHOT: SiteSnapshot = {
  "profile": {
    "nickname": "凉风凉",
    "signature": "未知的梦话与胡言乱语",
    "intro": "这里是呓语集，会记录一些不自知的情绪和严谨的呓语"
  },
  "footer": {
    "slogan": "呓语集",
    "caption": "未知的梦话与胡言乱语",
    "copyright": "Powered by React + Vite · {year}"
  },
  "about": "## 关于「呓语集」\n\n呓语集是一个用来记录 **动漫**、**随笔**、**读后感**、**数学笔记** 与 **学习分享** 的个人博客。现在也会更新一些同学之间的小说来引流。\n\n名字取成「呓语」，意喻着那些总是呢喃，无法考证但却无比纯粹的想法，同时也是无时无处不在的胡言乱语。意味着连接梦境与现实。\n\n本站支持 **Markdown** 与 **LaTeX** 数学公式写作，支持在文章中插入**图片**与**音乐链接**。\n可以在写作页直接编写，也可以导入 `.md` / `.tex` 文件。\n\n## 主题灵感\n\n网站配色灵感来自凉风凉：天空蓝的开衫、蜜金渐变珊瑚粉的长发、\n清透青蓝的眼睛，以及清新却难以触碰的校园风。\n\n"
};
