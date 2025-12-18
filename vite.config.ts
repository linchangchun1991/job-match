import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // 确保构建后的资源使用相对路径，解决部署黑屏问题
  define: {
    // 允许在浏览器代码中访问 process.env
    'process.env': {}
  }
})