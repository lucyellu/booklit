// Build the Bibliophile Reader (reader-bolt) and copy its dist into
// public/reader/ so Booklit can embed it as an iframe.
//
//   npm run build:reader
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const readerProj = path.resolve(root, '..', 'reader-bolt', 'project')
const dist = path.join(readerProj, 'dist')
const dest = path.join(root, 'public', 'reader')

if (!fs.existsSync(readerProj)) {
  console.error(`reader-bolt project not found at ${readerProj}`)
  process.exit(1)
}

console.log('Building reader-bolt…')
execSync('npm run build', { cwd: readerProj, stdio: 'inherit' })

fs.rmSync(dest, { recursive: true, force: true })
fs.cpSync(dist, dest, { recursive: true })
console.log(`Reader copied to ${dest}`)
