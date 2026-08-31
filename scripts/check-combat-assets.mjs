import { readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const assetDirectory = resolve(process.cwd(), 'public/assets')
const files = readdirSync(assetDirectory)
const webpFiles = files.filter((name) => name.endsWith('-pixel.webp'))
const legacyPngFiles = files.filter((name) => name.endsWith('-pixel.png'))
const totalBytes = webpFiles.reduce((sum, name) => sum + statSync(resolve(assetDirectory, name)).size, 0)

if (webpFiles.length !== 31) throw new Error(`Expected 31 optimized combat rasters, found ${webpFiles.length}.`)
if (legacyPngFiles.length) throw new Error(`Legacy combat PNGs remain: ${legacyPngFiles.join(', ')}`)
if (totalBytes >= 1_200_000) throw new Error(`Combat raster budget exceeded: ${totalBytes} bytes.`)

console.log(`Combat raster budget: ${webpFiles.length} WebP files, ${totalBytes} bytes.`)
