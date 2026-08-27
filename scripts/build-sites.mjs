import { mkdir, writeFile } from 'node:fs/promises'

const worker = `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)

    if (response.status !== 404 || request.method !== 'GET') {
      return response
    }

    const fallbackUrl = new URL(request.url)
    fallbackUrl.pathname = '/'
    return env.ASSETS.fetch(new Request(fallbackUrl, request))
  }
}
`

const wrangler = {
  name: 'cage-life',
  compatibility_date: '2026-08-28',
  compatibility_flags: ['nodejs_compat'],
  main: 'index.js',
  no_bundle: true,
  assets: {
    binding: 'ASSETS',
    directory: '../client',
    not_found_handling: 'single-page-application'
  }
}

await mkdir('dist/server', { recursive: true })
await writeFile('dist/server/index.js', worker)
await writeFile('dist/server/wrangler.json', `${JSON.stringify(wrangler)}\n`)
