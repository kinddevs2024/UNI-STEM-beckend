import formidable from 'formidable';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { adminGuard } from '../../../lib/admin-accounts.js';
import { handleCORS } from '../../../lib/api-helpers.js';
import { getUploadBaseDir } from '../../../lib/upload-path.js';
export const config = { api: { bodyParser: false } };
export default async function handler(req, res) {
  if (handleCORS(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  if (!await adminGuard(req, res)) return;
  let temporary;
  try {
    const form = formidable({ uploadDir: os.tmpdir(), keepExtensions: false, maxFiles: 1, maxFileSize: 5 * 1024 * 1024 });
    form.on('fileBegin', (_, file) => { temporary = file.filepath; });
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.photo) ? files.photo[0] : files.photo;
    if (!file) return res.status(400).json({ message: 'Choose a PNG, JPEG or WebP image.' });
    temporary = file.filepath;
    const bytes = await fs.readFile(temporary);
    const extension = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png'
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg'
      : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
    if (!extension) return res.status(400).json({ message: 'Choose a PNG, JPEG or WebP image.' });
    const directory = path.join(getUploadBaseDir(), 'prizes');
    await fs.mkdir(directory, { recursive: true });
    const name = `${crypto.randomUUID()}.${extension}`;
    await fs.writeFile(path.join(directory, name), bytes, { flag: 'wx' });
    return res.json({ photo: `/api/uploads/prizes/${name}` });
  } catch { return res.status(400).json({ message: 'Image upload failed. Use an image smaller than 5 MB.' }); }
  finally { if (temporary) await fs.unlink(temporary).catch(() => {}); }
}
