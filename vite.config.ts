import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 确保构建后的资源使用相对路径，解决部署黑屏问题
  // 移除 define 块，让浏览器环境能正确访问 index.html 中定义的全局变量
})