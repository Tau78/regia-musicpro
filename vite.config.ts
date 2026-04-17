import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

/** Scrive l'URL reale del dev server così Electron non dipende da una porta fissa (es. 5173 già in uso). */
function electronDevServerUrlPlugin(): Plugin {
  const urlFile = path.resolve(__dirname, 'dist-electron/dev-server-url.txt')
  return {
    name: 'electron-dev-server-url',
    configureServer(server) {
      try {
        fs.unlinkSync(urlFile)
      } catch {
        /* assente o non cancellabile */
      }
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address()
        let port = 5173
        let host = 'localhost'
        if (typeof addr === 'object' && addr && 'port' in addr && addr.port != null) {
          port = addr.port
        }
        if (typeof addr === 'object' && addr && 'address' in addr && addr.address) {
          const a = addr.address
          if (a !== '::' && a !== '0.0.0.0') host = a
        }
        const url = `http://${host}:${port}`
        fs.mkdirSync(path.dirname(urlFile), { recursive: true })
        fs.writeFileSync(urlFile, url, 'utf8')
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), electronDevServerUrlPlugin()],
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        output: path.resolve(__dirname, 'output.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
