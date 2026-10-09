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
  "about": "## About The Set of Murmurs\n\n**The Set of Murmurs** is a small personal space for keeping fragments of thought and memory: **anime**, **personal essays**, **reflections on books**, **mathematical notes**, and **things I have learned along the way**. From time to time, I also share stories written by my classmates, letting a few borrowed voices find their way here.\n\nThe name “Murmurs” refers to those thoughts that are always whispered, impossible to verify, yet remarkably pure. At the same time, it embraces the countless fragments of nonsense that drift through our minds, wherever and whenever they may appear. It represents a connection between dreams and reality.\n\nThe site supports writing in **Markdown** and **LaTeX**, with the ability to weave **images** and **music links** into an article.\n\nYou may write directly on the writing page, or bring your own `.md` / `.tex` files here.\n\n## Inspiration for the Theme\n\nThe visual language of the site is inspired by **Suzu Suzukaze**: the soft blue of a cardigan beneath the sky, hair flowing from **honey-gold into coral pink**, eyes clear as **blue-green glass**, and the fresh, translucent atmosphere of a school day that always seems close enough to remember, yet somehow impossible to reach.\n\nIt is a feeling of youth suspended between familiarity and distance, between the ordinary world and something just beyond it.\n"
};
