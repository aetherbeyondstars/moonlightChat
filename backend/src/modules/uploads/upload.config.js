// ============================================================================
// upload.config.js
// Configuración de Multer para guardar archivos subidos en disco local,
// bajo backend/uploads/<categoria>/. Cada categoría (avatars, servers,
// messages) tiene su propia subcarpeta para mantenerlo organizado.
// ============================================================================
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

const UPLOADS_ROOT = path.resolve('uploads');
const ALLOWED_MIME = [
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
  'application/zip', 'application/x-zip-compressed', 'application/x-tar', 'application/x-rar-compressed', 'application/gzip'
];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function makeStorage(category) {
  const dir = path.join(UPLOADS_ROOT, category);
  ensureDir(dir);

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error('Formato de archivo no soportado. Usa imágenes (PNG, JPG, WEBP, GIF), videos (MP4, WEBM, MOV) o archivos ZIP/comprimidos.'));
  }
  cb(null, true);
}

export function createUploader(category) {
  return multer({
    storage: makeStorage(category),
    fileFilter,
    limits: { fileSize: MAX_SIZE_BYTES },
  });
}

export function publicUrlFor(category, filename) {
  return `/uploads/${category}/${filename}`;
}

export { UPLOADS_ROOT };
