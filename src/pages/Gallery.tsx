import { useState, useEffect, useMemo, useReducer, useRef, useCallback, FormEvent, DragEvent } from 'react';
import type { CSSProperties } from 'react';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT, useLocale } from '../i18n';

/* ══════════════════════════════════════════════════════════════════════════════
   图集页（2026-10-09 重设计 · Saber 点定 B「中」档）
   ──────────────────────────────────────────────────────────────────────────────
   设计真值＝`design-mockups\g\n1-broadsheet\gallery.html`（重跑
   `node first\n1-as-frontend\build-n1-css.mjs` 生成 n1.css），样张实拍在
   `design-mockups\g\gallery-lab\`（A 密/B 中/C 疏三档 + 四份探针）。

   两条硬决定（都是他点的）：
     ① 版式＝瀑布流（masonry）；响应式列数 桌面 4 ／ ≤860px 3 ／ ≤520px 2；无「首图跨两列」的头条。
     ② 图片**下方**一行图注（不再压在图上）；顶上那排分类签**整排删掉**（数据里本来也没有分类字段）；
        四色缩成页底一条小色卡；点图开**可翻页**灯箱（←/→ · n/N · Esc）；**滚到底自动加载每批 24 张**。

   装箱为什么不用 CSS `columns`：多列 CSS 在追加新图时会**重排全部已显示的图**，
   配「滚到底自动加载」会让页面上半部分突然跳动。这里按「最短列优先」把图塞进当前最短的一列，
   已显示的一张都不动——三档实测追加 24 张时「已显示的图 0 张被移动」（对照组 CSS columns 动 4/6 张）。
   ══════════════════════════════════════════════════════════════════════════════ */

/* 滚到底自动加载的批量（他定的 24）。数据在 GalleryContext 里一次性取回，
   这里是**前台分页**：滚到底就把可见张数 +24；真改成服务端分页时只动这一条。 */
const BATCH = 24;

/* 页底四色小色卡的文案（色值/分类照他给的素材，一字不改）。
   ★ 2026-10-09 他裁决「Sky Blue / Honey / Coral / Teal Blue」：英文页取 en 栏，中文页取 zh。 */
const PLATES = [
  { c: '#5BA8D8', zh: '天空蓝', en: 'Sky Blue', cat: 'cat.anime' },
  { c: '#E8C9A0', zh: '蜜金', en: 'Honey', cat: 'cat.reading' },
  { c: '#E89B8A', zh: '珊瑚粉', en: 'Coral', cat: 'cat.essay' },
  { c: '#4A9BB8', zh: '青蓝', en: 'Teal Blue', cat: 'cat.math' },
] as const;

/* 列数与样张同步：桌面 4 / ≤860px 3 / ≤520px 2 */
function colsFor(w: number) {
  return w <= 520 ? 2 : w <= 860 ? 3 : 4;
}

/* 最短列优先装箱（与样张里的 window.__gal 同一套规则）：
   逐张放进当前累计高度最小的一列；高度用图片真实宽高比估，图注占位按 ratio 加一个常数。 */
function packColumns<T>(items: T[], cols: number, ratioOf: (item: T) => number): T[][] {
  const buckets: T[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  for (const item of items) {
    let k = 0;
    for (let j = 1; j < cols; j++) if (heights[j] < heights[k]) k = j;
    buckets[k].push(item);
    heights[k] += ratioOf(item) + 0.12;
  }
  return buckets;
}

export default function Gallery() {
  const t = useT();
  const { locale } = useLocale();
  usePageTitle(t('gallery.title'));
  const { images, addImage, removeImage } = useGallery();
  const { isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLInputElement>(null);

  /* —— 瀑布流：列数 · 图片真实宽高比 · 可见张数 —— */
  const [colCount, setColCount] = useState(() => colsFor(typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [visible, setVisible] = useState(BATCH);
  const [zoom, setZoom] = useState<number | null>(null);
  const ratioRef = useRef<Record<string, number>>({});
  const [ratioVersion, bumpRatio] = useReducer((n: number) => n + 1, 0);
  const bumpTimer = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onResize = () => setColCount(colsFor(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => () => { if (bumpTimer.current !== null) window.clearTimeout(bumpTimer.current); }, []);

  /* 图片加载完才知道真实比例；按 120ms 合批刷新，避免逐张触发的连续重排 */
  const noteRatio = useCallback((id: string, el: HTMLImageElement) => {
    if (!el.naturalWidth || ratioRef.current[id]) return;
    ratioRef.current[id] = el.naturalHeight / el.naturalWidth;
    if (bumpTimer.current === null) {
      bumpTimer.current = window.setTimeout(() => {
        bumpTimer.current = null;
        bumpRatio();
      }, 120);
    }
  }, []);

  const shown = useMemo(() => images.slice(0, visible), [images, visible]);
  const columns = useMemo(
    () => packColumns(shown, colCount, (img) => ratioRef.current[img.id] ?? 1.3),
    [shown, colCount, ratioVersion],
  );
  /* 灯箱的前后顺序＝视觉阅读顺序（列序），与样张一致 */
  const order = useMemo(() => columns.flat(), [columns]);
  const allShown = visible >= images.length;

  /* —— 滚到底自动加载：哨兵＝状态行，进视口就再来一批 —— */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => Math.min(v + BATCH, images.length));
        }
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [images.length]);

  /* —— 灯箱键盘（← / → 换张、Esc 关闭）＋ 打开时锁滚动 —— */
  const zoomOpen = zoom !== null;
  const orderLen = order.length;
  useEffect(() => {
    if (!zoomOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setZoom((z) => (z === null ? z : (z + 1) % orderLen));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setZoom((z) => (z === null ? z : (z - 1 + orderLen) % orderLen));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setZoom(null);
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [zoomOpen, orderLen]);

  const step = (d: number) => setZoom((z) => (z === null ? z : (z + d + orderLen) % orderLen));
  const current = zoom !== null ? order[zoom] : undefined;

  /* —— 上传（站长能力，不能删） —— */
  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError(t('gallery.wrongType'));
      return;
    }
    setFile(f);
    setError('');
    /* 样张的表单是「拖进去直接发」，真站点的图注要手填，所以拖完把光标送进图注框 */
    captionRef.current?.focus();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t('gallery.pickOne'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      const msg = await addImage(file, caption);
      if (msg) {
        setError(msg);
        alert(t('common.uploadFailed') + msg);
        return;
      }
    } catch (err) {
      const em = err instanceof Error ? err.message : String(err);
      setError(t('common.uploadFailed') + em);
      alert(t('common.uploadFailed') + em);
      return;
    } finally {
      setUploading(false);
    }
    setFile(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const capOf = (img: { caption: string }) => img.caption || t('gallery.unnamed');

  return (
    <>
      {/* 页头：照 `gallery.html` 的 .pagehead/.pagehead-txt/.kicker/h1/.lede */}
      <section className="pagehead">
        <div className="pagehead-txt">
          <div className="kicker">GALLERY</div>
          <h1>{t('gallery.title')}</h1>
          <p className="lede">{t('gallery.desc')}</p>
        </div>
      </section>

      <section className="sec">
        {images.length === 0 && <p className="gnote">{t('gallery.empty')}</p>}

        {/* 瀑布流：N 条并排的弹性列（列数见 .gal 的 --g-gap/colsFor） */}
        <div className="gal" data-cols={colCount}>
          {columns.map((col, ci) => (
            <div className="gcol" key={ci}>
              {col.map((img) => (
                <figure className="shot" key={img.id}>
                  <a
                    className="shot-link"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setZoom(order.findIndex((o) => o.id === img.id));
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.caption || t('gallery.imageAlt')}
                      loading="lazy"
                      onLoad={(e) => noteRatio(img.id, e.currentTarget)}
                    />
                  </a>
                  {/* 图注在图片**下方**（他点名要的），标题衬线、日期走二级墨色 */}
                  <figcaption>
                    <b>{capOf(img)}</b>
                    <span>{img.date || ''}</span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn ghost"
                        title={t('gallery.removeTitle')}
                        onClick={() => removeImage(img.id)}
                      >
                        {t('gallery.remove')}
                      </button>
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          ))}
        </div>

        {/* 滚到底自动加载的状态行（同时是哨兵） */}
        {images.length > 0 && (
          <div className="galmore" ref={sentinelRef}>
            <i className="pulse" />
            <span>
              {allShown
                ? t('gallery.allLoaded', { n: images.length })
                : t('gallery.loadedMore', { n: shown.length })}
            </span>
          </div>
        )}

        {/* 页底一条四色小色卡（只在本页，不动全站报尾） */}
        <div className="palette">
          <span className="plabel">{t('gallery.paletteLabel')}</span>
          <ul>
            {PLATES.map((p) => (
              <li key={p.c} style={{ '--c': p.c } as CSSProperties}>
                <i />
                <b>{locale === 'en' ? p.en : p.zh}</b>
                <em>{p.c}</em>
                <u>{t(p.cat)}</u>
              </li>
            ))}
          </ul>
        </div>

        {/* 样张没有的：站长上传表单（N1 表单语汇 .gform/.grow/.gfoot/.gnote/.btn） */}
        {isAdmin && (
          <form
            className="gform"
            onSubmit={handleAdd}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <div className="grow">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label={t('gallery.addImage')}
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <input
                ref={captionRef}
                type="text"
                placeholder={t('gallery.captionPlaceholder')}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <div className="gfoot">
              <span className="gnote">
                {file
                  ? file.name
                  : dragging
                    ? t('gallery.releaseToAdd')
                    : t('gallery.dropHint')}
              </span>
              <button type="submit" className="btn" disabled={uploading}>
                {uploading ? t('gallery.uploading') : t('gallery.addImage')}
              </button>
            </div>
            {error && <p className="gnote">{error}</p>}
          </form>
        )}
      </section>

      {/* 点图放大的翻页灯箱（N1 语汇；类名与样张一致） */}
      {current && (
        <div className="gview" onClick={(e) => { if (e.target === e.currentTarget) setZoom(null); }}>
          <figure>
            <img src={current.url} alt={current.caption || t('gallery.imageAlt')} />
            <figcaption>
              <b>{capOf(current)}</b>
              <span>{current.date || ''}</span>
            </figcaption>
          </figure>
          <div className="gview-bar">
            <span className="gview-no">{zoom! + 1} / {orderLen}</span>
            <button className="gview-btn" type="button" onClick={() => step(-1)}>{t('gallery.prev')}</button>
            <button className="gview-btn" type="button" onClick={() => step(1)}>{t('gallery.next')}</button>
            <button className="gview-btn" type="button" onClick={() => setZoom(null)}>{t('gallery.closeEsc')}</button>
          </div>
        </div>
      )}
    </>
  );
}
