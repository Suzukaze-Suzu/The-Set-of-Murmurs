-- 全文搜索加速索引（在 Supabase → SQL Editor 里执行一次即可）
-- 用途：让标题/摘要/正文的 ilike 模糊搜索走索引，文章多时搜索更快。
-- pg_trgm 扩展支持中文子串匹配（比内置全文检索对中文更友好）。

create extension if not exists pg_trgm;

create index if not exists articles_title_trgm
  on articles using gin (title gin_trgm_ops);

create index if not exists articles_summary_trgm
  on articles using gin (summary gin_trgm_ops);

create index if not exists articles_content_trgm
  on articles using gin (content gin_trgm_ops);
