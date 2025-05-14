import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'

export default defineConfig(({ command }) => {
    const configPath = path.resolve(__dirname, '..', 'config.yml')
    const configYaml = yaml.load(fs.readFileSync(configPath, 'utf8'))
    const apiPort = configYaml.Dashboard?.Port || 5000

    return {
        root: '.',
        plugins: [
            react()
        ],
        server: {
            port: 5173,
            proxy: {
                '/api': {
                    target: `http://localhost:${apiPort}`,
                    changeOrigin: true,
                    secure: false,
                    ws: true
                }
            }
        },
        build: {
            outDir: 'dist',
            emptyOutDir: true,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, 'index.html')
                }
            }
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        }
    }
})