import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))

for (const file of ['index.js', 'client.js']) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(`../${file}`, import.meta.url))], { cwd: packageRoot, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
JSON.parse(await readFile(new URL('../package.json', import.meta.url)))
JSON.parse(await readFile(new URL('../dsh.plugin.json', import.meta.url)))
const tests = spawnSync(process.execPath, ['--test'], { cwd: packageRoot, stdio: 'inherit' })
if (tests.status !== 0) process.exit(tests.status ?? 1)
console.log('dsh-reach-point: syntax and manifests OK')
