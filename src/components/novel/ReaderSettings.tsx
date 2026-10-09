import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useT } from '../../i18n';
import { useTheme } from '../../context/ThemeContext';

/* ══════════════════════════════════════════════════════════════════════════════
   小说「阅读设置」栏（共享零件，2026-10-09「正文单独开一页」拆分时抽出）
   ──────────────────────────────────────────────────────────────────────────────
   样张 `design-mockups\g\n1-broadsheet\novel.html` 475-498 的 `.reader`
   （`.reader-row`／`.rk`／`.seg`／`.bar`），类名一个不改、色号一个不加。
   档位文案全部沿用既有字典键（`shelf.textSize` / `shelf.sizeS…XL` / `shelf.lineSpacing` /
   `shelf.tight|normal|loose` / `shelf.nightMode`），**没有新文案**。

   两条硬口径（原样搬过来，一行没改）：
     · 字号 `novel-font`、行距 `novel-line` 存 localStorage，**全站共用一份**（所有书同一套档位）；
     · 夜间模式**收编进站内主题**（切全站 `data-theme`），不再自己存一套 `novel-theme`。

   `showProgress`：样张 `.reader` 是四行（字号／行距／深浅／进度）。
   用户点名阅读界面「不放进度」→ 阅读界面传 `false`（三行）；
   书介页保持现状四行（进度行的当前章从 localStorage 的 `novel-progress-<书id>` 反查）。
   ══════════════════════════════════════════════════════════════════════════════ */
interface Props {
  /** 是否出「进度」那一行（默认出；阅读界面按用户点选传 false） */
  showProgress?: boolean;
  /** 当前章序号（0 起）与总章数——只有 showProgress 时用 */
  curIx?: number;
  total?: number;
}

export default function ReaderSettings({
  showProgress = true,
  curIx = 0,
  total = 0,
}: Props) {
  const t = useT();
  const [fontIx, setFontIx] = useLocalStorage<number>('novel-font', 1);
  const [lineIx, setLineIx] = useLocalStorage<number>('novel-line', 1);
  const { theme: siteTheme, toggle: toggleSiteTheme } = useTheme();
  const night = siteTheme === 'dark';

  const readPct = total > 0 ? Math.round(((curIx + 1) / total) * 100) : 0;

  return (
    <div className="reader">
      <div className="reader-row">
        <span className="rk">{t('shelf.textSize')}</span>
        <span className="seg">
          {[t('shelf.sizeS'), t('shelf.sizeM'), t('shelf.sizeL'), t('shelf.sizeXL')].map((label, ix) => (
            <button key={label} className={ix === fontIx ? 'on' : undefined} onClick={() => setFontIx(ix)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="reader-row">
        <span className="rk">{t('shelf.lineSpacing')}</span>
        <span className="seg">
          {[t('shelf.tight'), t('shelf.normal'), t('shelf.loose')].map((label, ix) => (
            <button key={label} className={ix === lineIx ? 'on' : undefined} onClick={() => setLineIx(ix)}>
              {label}
            </button>
          ))}
        </span>
      </div>
      <div className="reader-row">
        <span className="rk">{t('shelf.nightMode')}</span>
        <span className="seg">
          {/* 2026-10-09：原来写死「浅」「深」，英文页会露汉字 ⇒ 走报头同一对短键（Light / Dark），
              中文栏仍是「浅」「深」，中文站一个字没变。 */}
          <button className={night ? undefined : 'on'} onClick={() => { if (night) toggleSiteTheme(); }}>{t('nav.lightShort')}</button>
          <button className={night ? 'on' : undefined} onClick={() => { if (!night) toggleSiteTheme(); }}>{t('nav.darkShort')}</button>
        </span>
      </div>
      {showProgress && (
        <div className="reader-row">
          <span className="rk">{t('shelf.chaptersTitle')}</span>
          <span className="bar"><i style={{ width: readPct + '%' }} /></span>
          <span className="meta">{curIx + 1}/{total} · {readPct}%</span>
        </div>
      )}
    </div>
  );
}

/** 正文档位（阅读界面 `.prose-read` 用；与上面两排按钮一一对应） */
export const FONT_SIZES = ['1.05rem', '1.2rem', '1.35rem', '1.5rem'];
export const LINE_HEIGHTS = ['1.8', '2', '2.2'];
