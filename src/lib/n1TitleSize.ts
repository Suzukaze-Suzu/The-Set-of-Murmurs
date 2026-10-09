/**
 * 英文抬头按标题长度分档的类名（user 2026-10-09 点单「丙」）。
 *
 * 为什么要在 JS 里算：CSS 的 `clamp()` 只认视口宽度，认不出**内容有多长**；
 * 而这里要的恰恰是「短标题保持样张的巨字、长标题自动收小」。
 *
 * 分档（字符数，按 trim 后的 UTF-16 长度计）：
 *   ≤ 22      → ''      保持样张原样（`.pagehead h1` 的 clamp(42px,5.4vw,68px)）
 *   23 – 40   → 't-mid' → clamp(32px,3.8vw,48px)
 *   > 40      → 't-long'→ clamp(30px,3vw,38px)
 *
 * ⚠️ 样式只挂在 `html[lang='en']` 下（见 `n1-app.css` 第 ⑬ 段），所以中文站挂了这个类
 * 也一个字不变——这就是为什么可以无脑对同一枚 `<h1>` 全站调用。
 */
export function n1TitleClass(text: string | undefined | null): string {
  const n = (text || '').trim().length;
  if (n > 40) return 't-long';
  if (n > 22) return 't-mid';
  return '';
}
