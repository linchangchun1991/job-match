
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', 
  define: {
    // 注入 API_KEY，如果环境变量为空则使用用户提供的备用 Key
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'AIzaSyBQquueBtsfVxqMQy4GV6kKaqLjVU9Wo20')
  }
})
