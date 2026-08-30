import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { translate } from 'bing-translate-api'

const root = process.cwd()
const output = path.join(root, 'src/locales/legacy-en.generated.json')
const sourceRoots = [path.join(root, 'src')]
const cjk = /[\u3400-\u9fff]/

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesIn(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]))
  return files.flat()
}

function collectText(file, source) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
  const values = new Set()
  const visit = (node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && cjk.test(node.text)) values.add(node.text.trim())
    if (ts.isJsxText(node) && cjk.test(node.text)) values.add(node.text.replace(/\s+/g, ' ').trim())
    if (ts.isTemplateExpression(node)) {
      let value = node.head.text
      node.templateSpans.forEach((span, index) => { value += `{${index}}${span.literal.text}` })
      if (cjk.test(value)) values.add(value.trim())
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return values
}

async function translated(text) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const result = await translate(text, 'zh-Hant', 'en')
      if (result.translation) return result.translation.trim()
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  return text
}

const candidates = (await Promise.all(sourceRoots.map(filesIn))).flat()
  .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('i18n.ts'))
const sourceValues = new Set()
for (const file of candidates) {
  const source = await readFile(file, 'utf8')
  collectText(file, source).forEach((value) => sourceValues.add(value))
}

let catalog = {}
try { catalog = JSON.parse(await readFile(output, 'utf8')) } catch { /* first generation */ }
const pending = [...sourceValues].filter((value) => !catalog[value]).sort()
let cursor = 0
async function worker() {
  while (cursor < pending.length) {
    const index = cursor
    cursor += 1
    const source = pending[index]
    catalog[source] = await translated(source)
    if (cursor % 50 === 0) {
      await mkdir(path.dirname(output), { recursive: true })
      await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`)
      process.stdout.write(`Translated ${cursor}/${pending.length}\n`)
    }
  }
}
await Promise.all(Array.from({ length: 20 }, worker))
catalog = Object.fromEntries(Object.entries(catalog).filter(([key]) => sourceValues.has(key)).sort(([a], [b]) => a.localeCompare(b)))
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, `${JSON.stringify(catalog, null, 2)}\n`)
process.stdout.write(`Catalog contains ${Object.keys(catalog).length} entries.\n`)
