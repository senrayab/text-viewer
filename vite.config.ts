import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const BUILD_ID = Date.now().toString(36)

/** 배포된 앱이 새 버전을 감지할 수 있도록 빌드 ID를 version.json으로 내보낸다 */
function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
    },
  }
}

export default defineConfig(({ command }) => ({
  // GitHub Pages는 https://senrayab.github.io/text-viewer/ 경로에서 서비스된다
  base: command === 'build' ? '/text-viewer/' : '/',
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  server: { port: 5177, strictPort: true },
  preview: { port: 5177, strictPort: true },
}))
