-- ============================================================================
-- 呓语集 · P3 翻译工作台（2026-09-21）
-- ----------------------------------------------------------------------------
-- Saber 的原话口径：「全部翻译，但是翻译部分我自己来，或者说要让我能修改翻译成果」
--   → 不做机翻灌库，改为「英文翻译工作台」：英文正文由他本人在写作页写。
--
-- 本文件的内容已经通过直连 Postgres 执行到 Supabase 项目
-- ghzcvuemtoqejyciirks 上（2026-09-21）。留档以便回滚 / 在新项目重建。
--
-- 回滚（会连译文一起删掉）：
--   drop table if exists public.article_translations;
--   alter table public.about_versions drop column if exists locale;
-- ============================================================================

-- ── 1. 文章译文表 ───────────────────────────────────────────────────────────
-- 主键 (article_id, locale)：一篇文章一种语言只有一条译文，工作台里反复保存＝覆盖同一条。
-- content 存 Markdown 正文；小说（articles.novel 有章节）额外用 chapters 存逐章译文
-- [{id,title,content}]，id 与中文原文章节 id 对齐，缺译的章节自动回退中文原文。
create table if not exists public.article_translations (
  article_id text        not null references public.articles(id) on delete cascade,
  locale     text        not null default 'en',
  title      text        not null default '',
  summary    text        not null default '',
  content    text        not null default '',
  chapters   jsonb,
  status     text        not null default 'draft',
  updated_at timestamptz not null default now(),
  primary key (article_id, locale),
  constraint article_translations_status_chk check (status in ('draft', 'reviewed'))
);

comment on table public.article_translations is
  '英文（及未来其它语言）译文工作台：status=draft 只有博主可见，reviewed 才对外上线。';

-- updated_at 由数据库盖章，不信任客户端时钟（也避免漏传导致时间戳不动）
create or replace function public.article_translations_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists article_translations_touch_trg on public.article_translations;
create trigger article_translations_touch_trg
  before insert or update on public.article_translations
  for each row execute function public.article_translations_touch();

-- ── 2. RLS ─────────────────────────────────────────────────────────────────
-- 与全站其它表一致：anon 只读、博主（写死的那颗 UUID）可写。
-- 唯一多出来的一条：**草稿不对公众开放**（status='draft' 的英文只给博主自己看），
-- 否则「标 reviewed 才上线」这条承诺在 API 层就是空的。
alter table public.article_translations enable row level security;

drop policy if exists "article_translations 公开读已审校" on public.article_translations;
create policy "article_translations 公开读已审校" on public.article_translations
  for select using (
    status = 'reviewed'
    or auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid
  );

drop policy if exists "article_translations 博主可写" on public.article_translations;
create policy "article_translations 博主可写" on public.article_translations
  for all
  using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid)
  with check (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);

create index if not exists article_translations_locale_status_idx
  on public.article_translations (locale, status);

-- ── 3. 关于页正文的英文版 ───────────────────────────────────────────────────
-- 关于页正文本来就在 about_versions 里按版本存，英文版**同样是版本**：
-- 加一列 locale（默认 zh＝现有全部中文版原样不动），英文版由工作台里的
-- 「English 关于页」入口写入 locale='en' 的新版本。
alter table public.about_versions
  add column if not exists locale text not null default 'zh';

create index if not exists about_versions_locale_date_idx
  on public.about_versions (locale, date desc);
