// Builds only the parts of a zip that checkImportZip reads: central directory entries and the end record.
// Test support, so a zip bomb can be described by its declared sizes without making one.
export function fakeZip(sizes: number[], overrides: { entries?: number; cdOffset?: number } = {}) {
  const header = 46;
  const nameLength = 1;
  const directory = sizes.length * (header + nameLength);
  const bytes = new Uint8Array(directory + 22);
  const view = new DataView(bytes.buffer);

  sizes.forEach((size, index) => {
    const at = index * (header + nameLength);

    view.setUint32(at, 0x02014b50, true);
    view.setUint32(at + 24, size, true);
    view.setUint16(at + 28, nameLength, true);
    bytes[at + header] = 0x61;
  });

  const end = directory;

  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 10, overrides.entries ?? sizes.length, true);
  view.setUint32(end + 12, directory, true);
  view.setUint32(end + 16, overrides.cdOffset ?? 0, true);

  return bytes;
}
