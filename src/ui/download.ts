// Faylni foydalanuvchiga berish: claude.ai artifact ichida `downloads` imkoniyati orqali,
// oddiy brauzerda esa <a download> orqali.

interface DownloadsNS {
  save(req: { filename: string; data: Blob | ArrayBuffer | string }): Promise<{ status: string }>;
}
interface ClaudeWin {
  claude?: { use?: (name: string) => Promise<unknown> };
}

let nsPromise: Promise<DownloadsNS | null> | null = null;

function downloadsNS(): Promise<DownloadsNS | null> {
  if (!nsPromise) {
    const c = (window as unknown as ClaudeWin).claude;
    if (c?.use) {
      nsPromise = c.use('downloads').then((x) => (x as DownloadsNS) ?? null).catch(() => null);
    } else {
      nsPromise = Promise.resolve(null);
    }
  }
  return nsPromise;
}

/** Artifact ichidami (sandbox — oddiy yuklab olish ishlamaydi). */
export function inClaudeViewer(): boolean {
  return !!(window as unknown as ClaudeWin).claude?.use;
}

export async function saveFile(filename: string, blob: Blob): Promise<'saved' | 'declined' | 'unavailable'> {
  const ns = await downloadsNS();
  if (ns) {
    try {
      await ns.save({ filename, data: blob });
      return 'saved';
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === 'declined') return 'declined';
      return 'unavailable';
    }
  }
  if (inClaudeViewer()) return 'unavailable';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}

// ---------- minimal ZIP (faqat "store", siqishsiz) ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // UTF-8 nomlar
    lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name as BlobPart, f.data as BlobPart);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    const entry = new Uint8Array(46 + name.length);
    entry.set(new Uint8Array(ch.buffer), 0);
    entry.set(name, 46);
    central.push(entry);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...(central as BlobPart[]), end.buffer], { type: 'application/zip' });
}
