// 构建时脚本：从 Supabase 读取公开文章，生成 public/rss.xml（随 Vite 构建发布到 dist/）
// 说明：
//   - 阅读权限依赖 articles 表的 RLS（匿名可读，与前端一致）
//   - 站点域名：部署后请在 Netlify 构建环境设置 SITE_URL（如 https://yiyuji.netlify.app），
//     否则 RSS 里的链接使用下方占位域名
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ghzcvuemtoqejyciirks.supabase.co';
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9M23ej9D_HWgfmtM5wfCng_T9N9WVGY';
const SITE_URL = process.env.SITE_URL || 'https://yiyuji.example.com';

const CATEGORY_LABEL = { anime: '读后感', essay: '随笔', reading: '小说', math: '数学笔记', study: '学习分享' };

function esc(s) {
  return String(s ?? '').replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function rfc822(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

async function main() {
  const url = `${SUPABASE_URL}/rest/v1/articles?select=id,title,date,summary,category&order=date.desc`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase 返回 ${res.status}`);
  const rows = await res.json();

  const items = rows
    .filter((r) => r && r.title && r.date)
    .map((r) => {
      const desc = String(r.summary || '').replace(/\]\]>/g, ']]&gt;');
      return `    <item>
      <title>${esc(r.title)}</title>
      <link>${SITE_URL}/#/article/${esc(r.id)}</link>
      <guid isPermaLink="false">${esc(r.id)}</guid>
      <pubDate>${rfc822(r.date)}</pubDate>
      <category>${esc(CATEGORY_LABEL[r.category] || r.category || '')}</category>
      <description><![CDATA[${desc}]]></description>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>呓语集</title>
    <link>${SITE_URL}/#/</link>
    <description>记录动漫、随想、读后感与数学学习的个人博客</description>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <language>zh-CN</language>
${items}
  </channel>
</rss>
`;
  const out = join(__dirname, '..', 'public', 'rss.xml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, xml, 'utf-8');
  console.log(`[rss] 已生成 ${out}（${rows.length} 篇文章）`);
}

main().catch((err) => {
  // 生成失败不阻断构建，只输出空壳 RSS
  console.warn('[rss] 生成失败（不影响构建）：', err && err.message ? err.message : err);
  const out = join(__dirname, '..', 'public', 'rss.xml');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>呓语集</title><link>${SITE_URL}/#/</link></channel></rss>\n`,
    'utf-8'
  );
});
