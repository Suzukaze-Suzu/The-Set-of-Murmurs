// Netlify Function：评论/留言被回复时，发邮件通知被回复者（评论主）。
// 依赖环境变量（Netlify → Site settings → Environment variables）：
//   - SUPABASE_URL            （或 VITE_SUPABASE_URL，与前端一致）
//   - SUPABASE_SERVICE_ROLE_KEY（Supabase 控制台 → Settings → API，service_role key，切勿放前端）
//   - RESEND_API_KEY          （resend.com 注册后获取，免费额度足够个人博客）
//   - MAIL_FROM               （可选，发件地址，默认 onboarding@resend.dev）
import { createClient } from '@supabase/supabase-js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const { parentId, replyName, replyContent, targetType } = body || {};
  if (!parentId || !replyName || !replyContent) {
    return new Response('OK', { status: 200 }); // 参数不全则不通知
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('缺少 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 环境变量');
    return new Response('Server Misconfigured', { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 查被回复的评论/留言
  const table = targetType === 'guestbook' ? 'guestbook' : 'comments';
  const { data: parent, error } = await supabase
    .from(table)
    .select('user_id, name, content')
    .eq('id', parentId)
    .maybeSingle();
  if (error || !parent || !parent.user_id) {
    return new Response('OK', { status: 200 }); // 被回复者不是注册用户，无法通知
  }

  // 用 service role 查用户邮箱（普通 RLS 读不到 auth.users）
  const { data: userData } = await supabase.auth.admin.getUserById(parent.user_id);
  const email = userData?.user?.email;
  if (!email) {
    return new Response('OK', { status: 200 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('缺少 RESEND_API_KEY 环境变量');
    return new Response('Server Misconfigured', { status: 500 });
  }

  const siteUrl = process.env.SITE_URL || 'https://www.the-set-of-murmurs.me';
  const short = (s) => (s && s.length > 120 ? s.slice(0, 120) + '…' : s || '');

  const html = `
    <div style="font-family:system-ui,'PingFang SC','Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e8e0d4;border-radius:12px">
      <h2 style="color:#3d6b8f;margin:0 0 4px">呓语集 · 新回复通知</h2>
      <p style="color:#8a6f4f;font-size:13px;margin:0 0 20px">你有一条新的回复</p>
      <div style="background:#faf6ef;border-radius:8px;padding:14px 16px;margin-bottom:12px">
        <div style="font-size:13px;color:#8a6f4f;margin-bottom:6px">你评论说：</div>
        <div style="color:#333">${short(parent.content)}</div>
      </div>
      <div style="background:#eef5fb;border-radius:8px;padding:14px 16px;margin-bottom:20px">
        <div style="font-size:13px;color:#3d6b8f;margin-bottom:6px"><strong>${replyName}</strong> 回复了你：</div>
        <div style="color:#333">${short(replyContent)}</div>
      </div>
      <a href="${siteUrl}/#/" style="display:inline-block;background:#5BA8D8;color:#fff;padding:10px 22px;border-radius:22px;text-decoration:none;font-size:14px">去呓语集看看</a>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || '呓语集 <onboarding@resend.dev>',
      to: [email],
      subject: `「呓语集」${replyName} 回复了你的评论`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('邮件发送失败：', res.status, text);
    return new Response('Email Failed', { status: 500 });
  }

  return new Response('OK', { status: 200 });
};
