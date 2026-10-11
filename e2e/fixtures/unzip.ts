// Reads a ZIP into a map of file name to bytes: enough for the account export (stored or deflated entries).
import zlib from 'node:zlib';

export function unzip(archive: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of central directory record: the last 22 bytes unless a comment follows.
  let end = archive.length - 22;
  while (end >= 0 && archive.readUInt32LE(end) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error('not a ZIP: no end-of-central-directory record');
  const count = archive.readUInt16LE(end + 10);
  let cursor = archive.readUInt32LE(end + 16);
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = archive.readUInt16LE(cursor + 10);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const raw = archive.subarray(start, start + compressedSize);
    files.set(name, method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}
