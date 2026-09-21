-- ============================================================================
-- 呓语集 · 翻译 v2（段落对照 + 更新逻辑重做） 2026-09-21
-- ----------------------------------------------------------------------------
-- 背景（Saber 原话）：「提升英文翻译的方式，最好支持在写作页直接有翻译，
-- 此外更新逻辑，现在不算很好用，给我一个方案。」→ 他拍板 **不加机翻/AI**，
-- 把力气花在「段落级中英对照」与「更新逻辑」上（v2 路线 B）。
--
-- 本文件相对 P3 加了四样东西：
--   ① article_translations.source_hash —— 记下译文保存时**中文原稿**的哈希，
--      中文改过就标「待复核」（articles 表没有 updated_at，只能用内容哈希）。
--   ② article_translations.segments —— 非小说文章的**段落级译文**
--      [{id,srcHash,en,i}]；小说逐章走下面的 chapters 表。
--   ③ article_translation_chapters —— 小说译文**逐章**存（P3 是整本塞在一个
--      jsonb 里，一次 Ctrl+S 全量重写、多窗口并行会静默互相覆盖）。
--   ④ article_translation_versions —— 每次保存由**数据库触发器**留快照，
--      每个 (文章, 语言, 单元) 只留最近 30 版，工作台可「回到这一版」。
--
-- 保留：P3 的 article_translations.chapters 列**不删**（老数据留在原地，
--      一行都不动），新代码优先读新表；两者都空＝这篇文章还没译。
--
-- 执行状态：本文件已直连 Postgres 执行到项目 ghzcvuemtoqejyciirks（2026-09-21）。
-- 回滚：
--   drop table if exists public.article_translation_versions;
--   drop table if exists public.article_translation_chapters;
--   alter table public.article_translations drop column if exists source_hash;
--   alter table public.article_translations drop column if exists segments;
-- ============================================================================

-- ── 1. article_translations 加两列 ──────────────────────────────────────────
-- source_hash：译文对应的中文原稿哈希（'' = 老数据/未记录，不当成「待复核」）
-- segments   ：非小说文章的段落译文 [{id, srcHash, en, i}]
alter table public.article_translations
  add column if not exists source_hash text not null default '';
alter table public.article_translations
  add column if not exists segments jsonb;

comment on column public.article_translations.source_hash is
  '保存译文时中文原稿（标题+正文+章节）的哈希；与当前原文不一致＝待复核。';
comment on column public.article_translations.segments is
  '非小说文章的段落级译文 [{id,srcHash,en,i}]；小说用 article_translation_chapters。';

-- ── 2. 逐章译文表（小说） ───────────────────────────────────────────────────
-- content  = 整篇/整段模式的正文（老数据、或他选择整段翻译时用）
-- segments = 段落级译文 [{id,srcHash,en,i}]；有它时优先，逐段回退中文
create table if not exists public.article_translation_chapters (
  article_id text        not null references public.articles(id) on delete cascade,
  locale     text        not null default 'en',
  chapter_id text        not null,
  title      text        not null default '',
  content    text        not null default '',
  segments   jsonb,
  src_hash   text        not null default '',
  updated_at timestamptz not null default now(),
  primary key (article_id, locale, chapter_id)
);

comment on table public.article_translation_chapters is
  '小说逐章译文：一章一行，改哪章写哪章（P3 的整本 jsonb 会全量重写）。';

create or replace function public.atc_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists atc_touch_trg on public.article_translation_chapters;
create trigger atc_touch_trg
  before insert or update on public.article_translation_chapters
  for each row execute function public.atc_touch();

alter table public.article_translation_chapters enable row level security;

-- 读：博主全读；公开只能读到「文章级 status=reviewed」的章（草稿章不外泄）
drop policy if exists "atc 博主可读" on public.article_translation_chapters;
create policy "atc 博主可读" on public.article_translation_chapters
  for select using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);

drop policy if exists "atc 公开读已审校" on public.article_translation_chapters;
create policy "atc 公开读已审校" on public.article_translation_chapters
  for select using (
    exists (
      select 1 from public.article_translations t
      where t.article_id = article_translation_chapters.article_id
        and t.locale     = article_translation_chapters.locale
        and t.status     = 'reviewed'
    )
  );

drop policy if exists "atc 博主可写" on public.article_translation_chapters;
create policy "atc 博主可写" on public.article_translation_chapters
  for all
  using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid)
  with check (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);

create index if not exists atc_locale_idx
  on public.article_translation_chapters (article_id, locale);

-- ── 3. 历史版本 ─────────────────────────────────────────────────────────────
-- 由**触发器**自动快照（不靠前端记得调用），每次保存留一份。
create table if not exists public.article_translation_versions (
  id          bigserial primary key,
  article_id  text        not null references public.articles(id) on delete cascade,
  locale      text        not null default 'en',
  unit        text        not null default 'article',  -- 'article' | 'chapter:<id>'
  title       text        not null default '',
  summary     text        not null default '',
  content     text        not null default '',
  segments    jsonb,
  status      text        not null default 'draft',
  source_hash text        not null default '',
  saved_at    timestamptz not null default now()
);

comment on table public.article_translation_versions is
  '译文历史快照（触发器自动写，每个单元只留最近 30 版）：工作台「回到这一版」。';

create index if not exists atv_key_idx
  on public.article_translation_versions (article_id, locale, unit, saved_at desc);

alter table public.article_translation_versions enable row level security;

drop policy if exists "atv 只有博主可读" on public.article_translation_versions;
create policy "atv 只有博主可读" on public.article_translation_versions
  for select using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);

-- 只留最近 30 版（same article+locale+unit）
create or replace function public.atv_prune()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.article_translation_versions v
  where v.article_id = new.article_id
    and v.locale = new.locale
    and v.unit = new.unit
    and v.id not in (
      select id from public.article_translation_versions
      where article_id = new.article_id and locale = new.locale and unit = new.unit
      order by saved_at desc, id desc
      limit 30
    );
  return null;
end $$;

drop trigger if exists atv_prune_trg on public.article_translation_versions;
create trigger atv_prune_trg
  after insert on public.article_translation_versions
  for each row execute function public.atv_prune();

-- article_translations 每次写入 → 快照
create or replace function public.atv_snapshot_article()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_translation_versions
    (article_id, locale, unit, title, summary, content, segments, status, source_hash)
  values
    (new.article_id, new.locale, 'article', new.title, new.summary, new.content,
     new.segments, new.status, new.source_hash);
  return null;
end $$;

drop trigger if exists atv_snapshot_article_trg on public.article_translations;
create trigger atv_snapshot_article_trg
  after insert or update on public.article_translations
  for each row execute function public.atv_snapshot_article();

-- 逐章表每次写入 → 快照（unit = 'chapter:<章节id>'）
create or replace function public.atv_snapshot_chapter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.article_translation_versions
    (article_id, locale, unit, title, content, segments, status, source_hash)
  values
    (new.article_id, new.locale, 'chapter:' || new.chapter_id, new.title, new.content,
     new.segments,
     coalesce((select status from public.article_translations t
               where t.article_id = new.article_id and t.locale = new.locale), 'draft'),
     new.src_hash);
  return null;
end $$;

drop trigger if exists atv_snapshot_chapter_trg on public.article_translation_chapters;
create trigger atv_snapshot_chapter_trg
  after insert or update on public.article_translation_chapters
  for each row execute function public.atv_snapshot_chapter();

-- ── 4. 老数据迁移（P3 的整本 jsonb → 逐章表） ───────────────────────────────
-- 执行时 article_translations 是空表（0 行），这条语句是留给将来/新项目重建用的：
-- 老章译文原样搬进 chapters 表，segments 留空 = 「整篇模式」，界面不会自动重切。
insert into public.article_translation_chapters
  (article_id, locale, chapter_id, title, content, segments, src_hash, updated_at)
select t.article_id, t.locale,
       coalesce(c->>'id', 'ch-' || (ord - 1)),
       coalesce(c->>'title', ''),
       coalesce(c->>'content', ''),
       null, '', t.updated_at
from public.article_translations t
cross join lateral jsonb_array_elements(t.chapters) with ordinality as e(c, ord)
where t.chapters is not null
  and jsonb_typeof(t.chapters) = 'array'
on conflict (article_id, locale, chapter_id) do nothing;
