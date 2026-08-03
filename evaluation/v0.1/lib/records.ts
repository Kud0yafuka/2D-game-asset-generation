import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function appendJsonLine(path: string, record: unknown) {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(record)}\n`, 'utf8')
}

export async function readJsonLines<T>(path: string): Promise<T[]> {
  try {
    const contents = await readFile(path, 'utf8')
    return contents
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}
