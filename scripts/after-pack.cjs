const fs = require('node:fs')
const path = require('node:path')

const archName = { 1: 'x64', 3: 'arm64' }

module.exports = async function afterPack(context) {
  const arch = archName[context.arch]
  if (!arch) return
  const other = arch === 'arm64' ? 'x64' : 'arm64'
  const img = path.join(context.packager.getResourcesDir(context.appOutDir), 'app.asar.unpacked/node_modules/@img')
  for (const name of [`sharp-darwin-${other}`, `sharp-libvips-darwin-${other}`]) {
    fs.rmSync(path.join(img, name), { recursive: true, force: true })
  }
}
