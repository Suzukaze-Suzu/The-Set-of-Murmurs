-- ============================================================================
-- 呓语集 · 标签翻译词典（P5，2026-09-21）
-- ----------------------------------------------------------------------------
-- 背景：Saber 的指令就四个字——「支持标签翻译」。此前英文线把标签
-- （文章卡片与正文页上的 `#标签`）原样留着中文，是「待裁决」清单里的一条；
-- 这四个字就是裁决：**标签也要能翻**。
--
-- 口径（沿用他 2026-09-21 选定的 A 案）：**缺译就回退中文标签，不加任何标记**，
-- 跟正文段落一个待遇——英文页读起来不断裂、读者感知最小。
--
-- 为什么是「一张全局词典」而不是「每篇文章各存一份标签译文」：
--   标签是跨文章复用的自由文本（`articles.tags` 是 text[]），全站 31 个标签里
--   「数学分析 / 百合 / 情感」这类会出现在多篇上。逐篇存＝同一个词他要翻好几遍，
--   且改一次要改好几处。所以以 **中文标签本身为主键**，一个词只翻一次、处处生效。
--
-- 状态：与文章译文同一套纪律——draft 只有博主看得见，**reviewed 才上英文站**。
--
-- 执行状态：本文件已直连 Postgres 执行到项目 ghzcvuemtoqejyciirks（2026-09-21）。
-- 回滚：
--   drop table if exists public.tag_translations;
-- ============================================================================

create table if not exists public.tag_translations (
  tag         text        not null,                 -- 中文标签原文（就是 articles.tags 里那一串）
  locale      text        not null default 'en',
  translation text        not null default '',      -- 英文；空串＝还没翻，公开页回退显示 tag 本身
  status      text        not null default 'draft', -- draft | reviewed
  updated_at  timestamptz not null default now(),
  primary key (tag, locale)
);

comment on table public.tag_translations is
  '标签翻译词典：一个中文标签一行，翻一次全站生效；reviewed 才在英文站显示。';
comment on column public.tag_translations.translation is
  '英文标签；空串＝未译，英文页回退显示中文标签（A 案：不加标记）。';

-- updated_at 由触发器盖章（前端不必传）
create or replace function public.tt_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tt_touch_trg on public.tag_translations;
create trigger tt_touch_trg
  before insert or update on public.tag_translations
  for each row execute function public.tt_touch();

alter table public.tag_translations enable row level security;

-- 读：博主全读（含草稿）
drop policy if exists "tt 博主可读" on public.tag_translations;
create policy "tt 博主可读" on public.tag_translations
  for select using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);

-- 读：公开只能读到已审校的（英文页拿的就是这一批）
drop policy if exists "tt 公开读已审校" on public.tag_translations;
create policy "tt 公开读已审校" on public.tag_translations
  for select using (status = 'reviewed' and translation <> '');

-- 写：只有博主
drop policy if exists "tt 博主可写" on public.tag_translations;
create policy "tt 博主可写" on public.tag_translations
  for all
  using (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid)
  with check (auth.uid() = 'd5d68f4e-efb3-4ff1-9a4b-3f24aaeff302'::uuid);
