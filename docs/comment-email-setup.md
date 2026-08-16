# 评论回复邮件通知 · 配置步骤

功能：有人回复你的评论/留言时，给被回复者发一封邮件提醒。

## 原理
纯前端（浏览器）拿不到邮箱、也发不了邮件，所以用 **Vercel 的服务器函数（Serverless Function）**代发：
前端提交回复 → 同时调用 `/api/comment-notify` → 函数用 service role 查被回复者的邮箱 → 调用 Resend 邮件服务发信。

> 函数代码在 `api/comment-notify.mjs`，Vercel 会自动把 `api/` 目录发布为 `/api/...` 接口。

## 需要准备
1. **Resend 账号**（发邮件服务）：https://resend.com 注册（免费额度个人博客足够）
   - 进入 Dashboard → API Keys → 创建 Key，复制（形如 `re_xxxxxxxx`）
   - 可选：在 Domains 里添加你的域名并验证，就能用自己域名发件；不配则用默认 `onboarding@resend.dev` 发件（只能发给你自己注册的邮箱测试）

2. **Supabase service_role key**：
   - Supabase 控制台 → Settings → API → 找到 `service_role` secret
   - ⚠️ 这是高权限密钥，**只能放服务端环境变量，绝不能写进前端代码**

## 在 Vercel 配置环境变量
Vercel → 你的项目 → Settings → Environment Variables → 添加（记得勾选 Production/Preview 环境）：

| 变量名 | 值 |
|---|---|
| `SUPABASE_URL` | 你的 Supabase 项目 URL（或复用 `VITE_SUPABASE_URL`） |
| `SUPABASE_SERVICE_ROLE_KEY` | 上面拿到的 service_role key |
| `RESEND_API_KEY` | 上面拿到的 Resend key |
| `MAIL_FROM` | 可选，如 `呓语集 <noreply@你的域名>` |

## 部署验证
1. 代码推送到 GitHub，Vercel 自动部署（api/ 目录会自动成为函数）
2. 用 A 账号在文章下评论，再用 B 账号回复 A 的评论
3. A 的邮箱收到「新回复通知」邮件
4. 函数日志：Vercel → 项目 → Functions（或 Deployments 里点某次部署 → Functions）→ comment-notify → Logs

## 常见问题
- 邮件没收到：先确认两个环境变量已配好并重新部署；再看 Vercel 函数日志里的报错
- 只有回复**注册用户**的评论才会发信（需要 user_id 反查邮箱），游客评论无法通知
- 邮件默认发件人 `onboarding@resend.dev` 只允许发给自己注册的邮箱；要发给别人需先验证自己的域名
