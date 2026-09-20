// 文章分类
export type Category =
  | 'anime'      // 读后感
  | 'essay'      // 随笔
  | 'reading'    // 小说
  | 'math'       // 数学笔记
  | 'study';     // 学习分享

export interface ArticleAttachment {
  name: string;   // 文件名
  url: string;    // 访问/下载地址
  size?: number;  // 字节数（可选）
}

export interface Article {
  id: string;
  title: string;
  content: string;        // Markdown / LaTeX 内容
  category: Category;
  tags: string[];
  date: string;           // YYYY-MM-DD
  favorite: boolean;      // 收藏/星标
  pinned: boolean;        // 置顶
  summary?: string;
  attachments?: ArticleAttachment[];  // 附件列表
  novel?: NovelMeta;              // 小说扩展（仅 category=reading 使用）
}

export interface Comment {
  id: string;
  articleId: string;      // 文章评论 或者 'guestbook' 表示留言板
  name: string;
  content: string;
  date: string;
  userId?: string;  // 留言/评论的作者（登录用户的 id），未登录为空
  parentId?: string;      // 回复对象：被回复的留言 id
  parentName?: string;    // 回复对象：被回复的人昵称（用于显示 @xxx）
  avatar?: string;        // 留言/评论者的头像
}

export interface Profile {
  nickname: string;
  avatar: string;         // 头像，空字符串表示用默认/未设置
  signature: string;
  intro: string;
}

export interface SiteSettings {
  title: string;
  theme: 'light' | 'dark';
}

// color=颜色（分类的色卡色：浅底/描边/实底都用它本身）；ink=该分类的**同色系墨色**（只给文字用）
// onFill=压在「分类色实底」上的字色（分类小签在亮色下改成实底了）：
//   第2j步（2026-09-14）：先改成**该分类自己的同色系墨色**（用户原话「你怎么全改成黑色字体了，
//   我让你把字改为同颜色的深色版本」）——实测天空蓝 2.14:1、珊瑚粉 2.61:1、蜜金 3.38:1，
//   同色系深色压同色实底必然糊。
//   第2k步（2026-09-14）：用户原话「在每一个文章左上角小圆圈内的分类文字用白色」
//   → **五类小签的字一律白字 #fff**（数学笔记/学习分享本来就是白字，本步把其余三类也改成白字）。
//   实测白字压色卡实底：天空蓝 2.61:1、珊瑚粉 2.21:1、蜜金 1.58:1、青蓝 3.15:1、灰蓝 3.24:1
//   （蜜金那档最低；用户点名要白字，两条都已记入 audit-contrast.mjs 的「已知取舍」。
//     要回到 4.5:1 只有一条路：把实底换成该色卡的 12% 浅档——数据记在第2j步文档里）。
//   暗色主题不动：暗色下小签＝「13% 该分类色淡底 + --cat-ink 字」，由 index.css 的「第2g步暗色还原块」管。
// 铁律（用户 2026-09-14）：「字全部用墨色，颜色全部不用墨色」——
//   ink 只出现在 color: 里；color 只出现在 background / border 里；
//   随笔这类粉色族的字用**珊瑚墨色** var(--coral-ink)（只给字用，不当底色，见 index.css 注释）。
// 2026-09-13 第2步：小说分类原来是墨绿 #2F6B4F，已换成蜜金——墨绿不在「主题灵感」的四色里。
export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string; ink: string; onFill: string }> = {
  anime:   { label: '读后感',      icon: '', color: '#5BA8D8', ink: '#2E6E92', onFill: '#fff' },
  essay:   { label: '随笔',      icon: '', color: '#E89B8A', ink: 'var(--coral-ink)', onFill: '#fff' },
  reading: { label: '小说',    icon: '', color: '#E8C9A0', ink: '#8F6220', onFill: '#fff' },
  math:    { label: '数学笔记',  icon: '', color: '#4A9BB8', ink: '#2A6577', onFill: '#fff' },
  study:   { label: '学习分享',  icon: '', color: '#8A8F9A', ink: '#5C6469', onFill: '#fff' },
};


// Bug 反馈（留言板里的报错/bug反馈区）
export interface BugReport {
  id: string;
  userId?: string;      // 提交反馈的用户 id
  nickname: string;     // 提交者昵称
  category: string;     // 分类：bug / ui / feature / other
  content: string;      // 问题/报错描述
  status: string;       // 状态：待处理 / 已解决
  date: string;
}

export const BUG_CATEGORIES: { value: string; label: string }[] = [
  { value: 'bug', label: 'Bug 报错' },
  { value: 'ui', label: '界面问题' },
  { value: 'feature', label: '功能建议' },
  { value: 'other', label: '其他' },
];

// 2026-09-20 首页改版：用户要求「交换数学笔记和小说位置」→ 数组里把 math 提到 reading 前面，
// 顶栏那排分类彩点、文章页的分类筛选按钮（都按本数组渲染）顺序随之同步。
// 注意：首页 Home.tsx 已不再按本数组分区展示（分类改从彩点/文章页进），本数组只决定「入口的顺序」。
export const CATEGORIES: Category[] = ['anime', 'essay', 'math', 'reading', 'study'];

// 小说扩展数据（仅 category = 'reading' 使用）
export interface NovelChapter {
  id: string;        // 章节 id
  title: string;     // 章节标题（如 第一章 风起）
  content: string;   // 该章正文（Markdown）
  order: number;     // 章节顺序
  part?: string;     // 所属部分名（可选），该部分首章渲染为 # 大标题
  wordCount?: number; // 该章字数
}

export type NovelStatus = 'serializing' | 'completed' | 'paused';

export interface NovelMeta {
  author?: string;                       // 作者（同学名字）
  cover?: string;                        // 封面图 URL
  status?: NovelStatus;                  // serializing 连载 / completed 完结 / paused 暂停
  synopsis?: string;                     // 简介
  chapters?: NovelChapter[];             // 章节列表（按 order 排序）
  wordCount?: number;                    // 总字数
}

export const NOVEL_STATUS_META: Record<NovelStatus, { label: string; color: string; ink: string }> = {
  serializing: { label: '连载中', color: '#4A9BB8', ink: '#2A6577' },
  completed:   { label: '已完结', color: '#5BA8D8', ink: '#2E6E92' },
  paused:      { label: '暂停更新', color: '#8A8F9A', ink: '#5C6469' },
};



// 友情链接
export interface FriendLink {
  id: string;
  name: string;      // 站点名称
  url: string;       // 网址
  desc?: string;     // 一句话描述
  avatar?: string;   // 站点图标图 URL
  order: number;     // 排序（小在前）
}