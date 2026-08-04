import { createContext, useContext } from 'react';
import { Article, Category } from '../types';

export const storageKey = 'yiyuji_articles';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 初始示例文章
export const initialArticles: Article[] = [
  {
    id: 'welcome',
    title: '欢迎来到呓语集',
    category: 'essay',
    tags: ['欢迎', '随想'],
    date: new Date().toISOString().slice(0, 10),
    favorite: true,
    pinned: true,
    summary: '这里是记录我小小心事与碎碎念的地方。',
    content: `# 欢迎来到呓语集

这里是**呓语集**，一个记录动漫、随想、读后感与数学学习的小角落。

## 关于本站

- **动漫** —— 看番的记录与分享
- **随笔** —— 生活中的碎碎念
- **读后感** —— 阅读的思考
- **数学笔记** —— $\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}$ 这样的大学数学知识
- **学习分享** —— 学习方法与心得

## 你可以做什么

- 在「写作」页用 Markdown 或 LaTeX 记下想法
- 在「导入」功能导入 \`.md\` 或 \`.tex\` 文件
- 在底部的留言板留下你的足迹

> 像凉风凉那样，外冷内热地记录下每一个认真生活的小瞬间吧。
`
  },
  {
    id: 'welcome-math',
    title: '欧拉公式的浪漫',
    category: 'math',
    tags: ['复变函数', '欧拉'],
    date: new Date().toISOString().slice(0, 10),
    favorite: true,
    pinned: false,
    summary: '数学中最美的公式之一。',
    content: `# 欧拉公式的浪漫

被誉为**数学中最优美的公式**之一：

$$ e^{i\\pi} + 1 = 0 $$

它把五个最重要的常数联系在了一起：\\(e\\)、\\(i\\)、\\(\\pi\\)、\\(1\\)、\\(0\\)。

## 从泰勒展开出发

指数函数的泰勒展开：

$$ e^x = 1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots $$

把 \\(x = i\\theta\\) 代入：

$$ e^{i\\theta} = \\cos\\theta + i\\sin\\theta $$

这就是欧拉公式。当 \\(\\theta = \\pi\\) 时：

$$ e^{i\\pi} = \\cos\\pi + i\\sin\\pi = -1 $$

即欧拉恒等式成立。
`
  },
  {
    id: 'welcome-anime',
    title: '为什么我喜欢看动漫',
    category: 'anime',
    tags: ['随笔', '动画'],
    date: new Date().toISOString().slice(0, 10),
    favorite: false,
    pinned: false,
    summary: '动画里藏着很多温柔而真实的瞬间。',
    content: `# 为什么我喜欢看动漫

有人说动画是给小孩子看的，但我觉得，好的动画里藏着很多**温柔的勇气**。

## 关于凉风凉

今天想聊聊**凉风凉**。

她是藤咲私立高中的一年级学生，也是**优的青梅竹马**。留着天生金发，眼神凶悍，常被误认为是不良女孩。可她其实外冷内热，总是倾听优的烦恼，嘴上敷衍却格外珍视对方。

> 就像真正的友情那样，未必说漂亮话，却一直在身边。

## 一点感想

动漫吸引我的，从来不是华丽的画面，而是那些**认真生活的普通人**——他们会害怕、会逞强、也会偷偷温柔。
`
  },
];

interface ArticleContextType {
  articles: Article[];
  addArticle: (a: Article) => void;
  updateArticle: (a: Article) => void;
  deleteArticle: (id: string) => void;
  toggleFavorite: (id: string) => void;
  togglePinned: (id: string) => void;
  getByCategory: (c: Category) => Article[];
  getById: (id: string) => Article | undefined;
}

export const ArticleContext = createContext<ArticleContextType | null>(null);

export function useArticles() {
  const ctx = useContext(ArticleContext);
  if (!ctx) throw new Error('useArticles must be used within ArticleProvider');
  return ctx;
}

