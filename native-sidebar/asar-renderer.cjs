// Rewrites the `out/renderer` entry of an Electron app.asar index to list the files of a new
// renderer build. Orca ships every renderer file unpacked (in app.asar.unpacked), so only the
// index changes and the packed data that follows it is copied unchanged.
//
// usage: node asar-renderer.cjs <app.asar> <new renderer dir> <output asar>
'use strict'

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const RENDERER_PATH = ['out', 'renderer']
const BLOCK_SIZE = 4 * 1024 * 1024

function fail(message) {
  process.stderr.write(`asar-renderer: ${message}\n`)
  process.exit(1)
}

/** Reads the archive's JSON index and where its packed data starts. */
function readHeader(archive) {
  const fd = fs.openSync(archive, 'r')
  try {
    const sizeBuf = Buffer.alloc(8)
    fs.readSync(fd, sizeBuf, 0, 8, 0)
    const headerSize = sizeBuf.readUInt32LE(4)
    const headerBuf = Buffer.alloc(headerSize)
    fs.readSync(fd, headerBuf, 0, headerSize, 8)
    const stringLength = headerBuf.readUInt32LE(4)
    const json = headerBuf.subarray(8, 8 + stringLength).toString('utf8')
    return { header: JSON.parse(json), dataOffset: 8 + headerSize }
  } finally {
    fs.closeSync(fd)
  }
}

/** Serialises an index the way Chromium's Pickle does: length-prefixed, 4-byte aligned. */
function encodeHeader(header) {
  const json = Buffer.from(JSON.stringify(header), 'utf8')
  const padded = Math.ceil(json.length / 4) * 4
  const headerPickle = Buffer.alloc(8 + padded)
  headerPickle.writeUInt32LE(4 + padded, 0)
  headerPickle.writeUInt32LE(json.length, 4)
  json.copy(headerPickle, 8)
  const sizePickle = Buffer.alloc(8)
  sizePickle.writeUInt32LE(4, 0)
  sizePickle.writeUInt32LE(headerPickle.length, 4)
  return Buffer.concat([sizePickle, headerPickle])
}

function integrity(file) {
  const data = fs.readFileSync(file)
  const blocks = []
  for (let start = 0; start < data.length; start += BLOCK_SIZE) {
    blocks.push(crypto.createHash('sha256').update(data.subarray(start, start + BLOCK_SIZE)).digest('hex'))
  }
  return {
    size: data.length,
    integrity: {
      algorithm: 'SHA256',
      hash: crypto.createHash('sha256').update(data).digest('hex'),
      blockSize: BLOCK_SIZE,
      blocks: blocks.length > 0 ? blocks : [crypto.createHash('sha256').update('').digest('hex')]
    }
  }
}

/** Index entries for a directory whose files all live unpacked. */
function unpackedTree(dir) {
  const files = {}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files[entry.name] = { files: unpackedTree(full).files }
    } else if (entry.isFile()) {
      const { size, integrity: check } = integrity(full)
      files[entry.name] = { size, unpacked: true, integrity: check }
    }
  }
  return { files }
}

function main() {
  const [archive, rendererDir, output] = process.argv.slice(2)
  if (!archive || !rendererDir || !output) fail('usage: node asar-renderer.cjs <app.asar> <renderer dir> <output>')
  if (!fs.existsSync(path.join(rendererDir, 'index.html'))) fail(`${rendererDir} has no index.html`)

  const { header, dataOffset } = readHeader(archive)
  const parent = RENDERER_PATH.slice(0, -1).reduce((node, name) => node?.files?.[name], header)
  const current = parent?.files?.[RENDERER_PATH.at(-1)]
  if (!current?.files) fail('the archive has no out/renderer directory')

  const packedInside = JSON.stringify(current).includes('"offset"')
  if (packedInside) fail('out/renderer has packed files; this tool only swaps an all-unpacked renderer')

  parent.files[RENDERER_PATH.at(-1)] = unpackedTree(rendererDir)
  const data = fs.readFileSync(archive).subarray(dataOffset)
  fs.writeFileSync(output, Buffer.concat([encodeHeader(header), data]))

  const check = readHeader(output)
  if (!check.header.files.out.files.renderer.files['index.html']) fail('the rewritten index lost index.html')
}

main()
