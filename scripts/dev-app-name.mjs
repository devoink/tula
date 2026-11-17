import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const APP_NAME = '图拉Tula'
const require = createRequire(import.meta.url)
const executable = require('electron')
const bundle = join(dirname(executable), '..', '..')
const plist = join(bundle, 'Contents', 'Info.plist')

for (const key of ['CFBundleName', 'CFBundleDisplayName']) {
  execFileSync('plutil', ['-replace', key, '-string', APP_NAME, plist], { stdio: 'ignore' })
}

const lsregister = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister'
try {
  execFileSync(lsregister, ['-f', bundle], { stdio: 'ignore' })
} catch {
  // 下次启动仍会读取 Info.plist 里的名称
}
