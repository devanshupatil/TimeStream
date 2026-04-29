import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    root: 'src/renderer',          // where index.html lives
    build: {
        outDir: '../../dist/renderer' // where to output compiled files
    },
    server: { port: 5173 },        // dev server port (Electron connects to this)
    test: {
        root: process.cwd(),         // run tests from project root
        environment: 'jsdom',        // simulate a browser for React component tests
        globals: true,
        setupFiles: ['./tests/setup.js']
    },
    resolve: {
        alias: {
            'electron': path.resolve(process.cwd(), 'tests/__mocks__/electron.js'),
            'electron-updater': path.resolve(process.cwd(), 'tests/__mocks__/electron-updater.js')
        }
    }
})
