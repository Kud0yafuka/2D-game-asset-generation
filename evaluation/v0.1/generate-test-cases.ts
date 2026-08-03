import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { stringify } from 'csv-stringify/sync'
import { buildCases } from './cases'

const outputPath = fileURLToPath(new URL('./test-cases.csv', import.meta.url))
const columns = [
  'case_id',
  'category',
  'style',
  'complexity',
  'prompt_raw',
  'size',
  'frame_count',
  'palette',
  'seed',
  'transparent',
  'style_lock',
]

await writeFile(outputPath, stringify(buildCases(), { header: true, columns }), 'utf8')
console.log(`Wrote ${buildCases().length} frozen cases to ${outputPath}`)
