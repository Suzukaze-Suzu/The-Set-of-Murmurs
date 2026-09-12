import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initThemeFavicon } from './lib/favicon'
import './index.css'

// 标签栏图标跟着浏览器深浅色切换（<link media> 不可靠，改由 JS 控制）
initThemeFavicon()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
