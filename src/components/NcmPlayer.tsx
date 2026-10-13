/* ══════════════════════════════════════════════════════════════════════════════
   NcmPlayer.tsx —— 呓语集自绘的网易云播放器（方案 C，2026-10-13）
   ──────────────────────────────────────────────────────────────────────────────
   为什么要自绘（用户原话「我希望能修改网易云外链播放的样式，有些不搭配，
   而且部分网易云歌曲由于版权问题无法生成外链，给我方案解决」）：
     · 官方 `<iframe outchain/player>` 的内部 DOM 在网易云服务器上，本站 CSS
       **进不去**（跨源）→ 里面的圆角与网易云绿永远改不掉，与 N1 版式不同族；
     · 更麻烦的是**版权歌**：那支播放器对无版权/下架/VIP 歌曲渲染一个**空白盒子**
       （不报错、不提示），读者只看到一个死灰框。

   这一支把「播放器」拆成两件互不依赖的事：
     ① **曲目信息**（曲名/歌手/时长）→ 决定**渲不渲染**。
     ② **音频地址**（外链能否真播）→ 只影响那枚播放键。

   ⚠️⚠️ 2026-10-13 晚重大修正：取数**必须走自家同源代理 /api/ncm**，不能再直连网易云。
       原先这里直接 `fetch('https://music.163.com/api/…')`，真浏览器实测**必失败**：
         TypeError: Failed to fetch
       根因＝那个接口响应里**完全没有 `Access-Control-Allow-Origin` 头**，浏览器跨源读不到
       （可用歌与版权歌**一律**失败 → 播放器整块不渲染，功能等于从没工作过）。
       当时 32 项探针全绿是**假安心**：它们只验 DOM 形状与计算样式，**不跑真实网络**。
       ⇒ 现在改打 `/api/ncm?id=…`（由 `blog/api/ncm.mjs` 在服务器侧代取并裁剪）。
       前端从此**不再碰 music.163.com**，也就没有同源问题。
   ══════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useRef, useState } from 'react';

interface SongInfo {
  name: string;
  artist: string;
  /** 毫秒 */
  duration: number;
  /** 音频直链（空字符串＝版权受限） */
  url: string;
}

/** 代理返回的形状（与 blog/api/ncm.mjs 严格对应） */
type NcmApiResult =
  | { ok: true; id: string; song: SongInfo | null }
  | { ok: false; reason: string };

/** 毫秒 → m:ss */
function fmt(ms: number): string {
  if (!ms || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

export default function NcmPlayer({ id }: { id: string }) {
  /** 查到曲目信息 */
  const [info, setInfo] = useState<SongInfo | null>(null);
  /** 上游明确答「查无此曲」（songs:[]）＝版权/下架，拿不到任何曲目信息 */
  const [restricted, setRestricted] = useState(false);
  /** 代理或上游整体失败（网络/超时）→ 静默不渲染，靠下面那行兜底链接 */
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/ncm?id=' + encodeURIComponent(id), { credentials: 'omit' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = (await r.json()) as NcmApiResult;
        if (!j || j.ok !== true) throw new Error('proxy ' + (j as any)?.reason);
        if (!alive) return;
        if (j.song) setInfo(j.song);
        else setRestricted(true);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // 代理/上游整体挂了＝静默不渲染（下面那行「在网易云中播放」链接仍在）
  if (failed) return null;
  // 取数中：占位，避免版面跳动（高度与卡片一致）
  if (!info && !restricted) {
    return <div className="ncm-card ncm-loading" aria-hidden="true" style={{ visibility: 'hidden' }} />;
  }

  const canPlay = Boolean(info?.url);

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !canPlay) return;
    if (a.paused) { void a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  /* ── 受限态：上游连曲名都给不出来（歌曲已下架/无版权资料）───────────────
     2026-10-13 用户拍板「甲」，我在此拍了一条设计裁决：
     **留一行可见提示，而不是整块消失**——用户是**有意**把音乐放在那儿的，
     静默消失会让他以为功能又坏了。
     ⚠️ 要换成「整块隐藏」＝把下面这个 return 改成 `return null`，**一行**。
     复用 .ncm-card / .ncm-title / .ncm-sub 全部现成样式，不新增 CSS。 */
  if (restricted) {
    return (
      <div className="ncm-card ncm-restricted">
        <span className="ncm-play" aria-hidden="true" style={{ opacity: 0.4, cursor: 'default' }}>▶</span>
        <span className="ncm-meta">
          <b className="ncm-title">该曲目在网易云版权受限</b>
          <span className="ncm-sub">暂不可播　·　可点下方链接前往网易云收听</span>
        </span>
      </div>
    );
  }

  return (
    <div className="ncm-card">
      <button
        type="button"
        className="ncm-play"
        onClick={toggle}
        disabled={!canPlay}
        title={canPlay ? (playing ? '暂停' : '播放') : '版权受限，请到网易云收听'}
        aria-label={canPlay ? (playing ? '暂停' : '播放') : '版权受限'}
        style={canPlay ? undefined : { opacity: 0.4, cursor: 'default' }}
      >
        {playing ? '❙❙' : '▶'}
      </button>
      <span className="ncm-meta">
        <b className="ncm-title">{info!.name}</b>
        <span className="ncm-sub">
          {info!.artist}
          {canPlay ? '' : '　·　版权受限，暂不可播'}
        </span>
      </span>
      <span className="ncm-time">{fmt(info!.duration)}</span>
      {canPlay && (
        <audio ref={audioRef} src={info!.url} preload="none" onEnded={() => setPlaying(false)} />
      )}
    </div>
  );
}
