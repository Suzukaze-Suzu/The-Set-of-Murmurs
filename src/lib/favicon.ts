// 标签栏（favicon）图标跟随浏览器/系统的深浅色。
// 背景：index.html 里原本用 <link rel="icon" href="/favicon-dark.svg" media="(prefers-color-scheme: dark)"> 切换，
// 但 Chromium 长期不支持 link[rel=icon] 上的 media（WebKit 对 SVG favicon + media 也有未修 bug），
// 实测浏览器切深色后标签栏图标并不变，所以改为 JS 直接改 href，行为在所有浏览器一致。
// 注：这里跟随的是「浏览器/操作系统的深色设置」，与站内主题开关（ThemeContext 的 data-theme）无关；
// 若想改成跟随站内主题，把 matches 换成 document.documentElement.dataset.theme === 'dark' 即可。
const LIGHT_ICON = '/favicon.svg';
const DARK_ICON = '/favicon-dark.svg';

function apply(dark: boolean) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-theme-icon]');
  if (!link) return;
  const href = dark ? DARK_ICON : LIGHT_ICON;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

export function initThemeFavicon() {
  if (typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  apply(mq.matches);
  const onChange = (e: MediaQueryListEvent) => apply(e.matches);
  if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
  else mq.addListener(onChange);
}
