import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initThemeFavicon } from './lib/favicon'
import { localeFromPath } from './i18n'
import { preloadForBoot } from './lib/translationPreload'
import './index.css'
import './styles/broadsheet.css'   // 报纸版外壳层（B1 起）：整页版框 + 竖排刊眉 + 天头鱼尾。去掉 Layout 上的 bs 类即整层回退。
import './styles/buttons.css'      // B6 同族按钮收口（2026-10-08）：.btn* 之外的按钮族照同一套两级按钮走。删本行＋删该文件即回退。
import './styles/n1.css'           // N1 大报样张「直接做真前端」（2026-10-08）：由 first\n1-as-frontend\build-n1-css.mjs 从样张生成。
                                   // 必须排在最后一行——迁移到样张的页面靠它，同一个 .btn 两套并存时它要赢；未迁移页面一行都不受它影响。
import './styles/n1-app.css'       // N1 零件补齐层（2026-10-08）：样张里只是装饰的控件（工具栏按钮/输入框/上传面板）在真前端要能点。

// 标签栏图标跟着浏览器深浅色切换（<link media> 不可靠，改由 JS 控制）
initThemeFavicon()

/* ★ 2026-10-09「英文站不依附中文站，先加载英文翻译」★
   英文线（/en/*）在挂载 React 之前，先把**已上线的英文译文**拿回来 —— 于是首帧就是英文，
   不再出现「先中文、再跳成英文」（改前：中文 articles 先到，译文第二个请求才到）。
   某篇没有已上线译文 → 那一篇回退中文原文（口径与 lib/translations.ts 一致）。

   三条约束（见 lib/translationPreload.ts 顶部）：
     · 中文线**一个请求都不发**，也不等这一下 —— 中文站的行为与改动前逐字相同；
     · 最多等 3 秒、错误一律吞掉 —— 拿不到就照常挂载（退回中文原文），
       这期间屏幕上留的是 index.html 里既有的 #splash 加载屏，没有新控件也没有新动画；
     · 只发一轮请求，TranslationContext 复用同一份结果，不重复打数据库。 */
const LOCALE = localeFromPath(window.location.pathname)

async function boot() {
  if (LOCALE === 'en') await preloadForBoot('en')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

boot()
