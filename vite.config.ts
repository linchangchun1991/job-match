
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', 
  define: {
    // 注入环境变量，优先读取 Zeabur/系统配置的环境变量
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'AIzaSyBQquueBtsfVxqMQy4GV6kKaqLjVU9Wo20'),
    'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
    'process.env.SUPABASE_KEY': JSON.stringify(process.env.SUPABASE_KEY || '')
  }
})
