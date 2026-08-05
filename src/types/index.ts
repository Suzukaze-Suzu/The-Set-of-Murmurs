// 文章分类
export type Category =
  | 'anime'      // 动漫
  | 'essay'      // 随笔
  | 'reading'    // 读后感
  | 'math'       // 数学笔记
  | 'study';     // 学习分享

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

export const CATEGORY_META: Record<Category, { label: string; icon: string; color: string }> = {
  anime:   { label: '动漫',      icon: '', color: '#5BA8D8' },
  essay:   { label: '随笔',      icon: '', color: '#E89B8A' },
  reading: { label: '读后感',    icon: '', color: '#2F6B4F' },
  math:    { label: '数学笔记',  icon: '', color: '#4A9BB8' },
  study:   { label: '学习分享',  icon: '', color: '#8A8F9A' },
};

export const CATEGORIES: Category[] = ['anime', 'essay', 'reading', 'math', 'study'];

