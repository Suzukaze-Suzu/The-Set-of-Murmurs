import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // 必须是 '/'：站点部署在域名根目录，且改用 BrowserRouter 后会出现 /article/xxx 这类深路径，
  // 若用 './' 则构建产物里的资源引用（./assets/...、./favicon.svg）会被解析成 /article/assets/... 而 404，整站白屏
  base: '/',
  server: {
    port: 5173,
    open: true
  }
})
