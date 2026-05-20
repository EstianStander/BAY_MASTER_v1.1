// Configuration file for BayMaster application
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');

const resolveStoragePath = (rawValue, fallbackRelativePath) => {
  const value = (rawValue || '').toString().trim();
  if (!value) return path.join(ROOT_DIR, fallbackRelativePath);
  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
};

const normalizeUrlPath = (rawValue, fallback) => {
  const value = (rawValue || '').toString().trim();
  if (!value) return fallback;
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, '') || fallback;
};

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  database: {
    // Add database configuration here when needed
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'baymaster'
  },
  app: {
    name: 'BayMaster',
    version: '1.0.0'
  },
  media: {
    projectImagesDir: resolveStoragePath(process.env.PROJECT_IMAGES_DIR, 'public/project-images'),
    equipmentUploadsDir: resolveStoragePath(process.env.EQUIPMENT_UPLOADS_DIR, 'public/uploads/equipment'),
    visitorSignaturesDir: resolveStoragePath(process.env.VISITOR_SIGNATURES_DIR, 'public/uploads/visitors'),
    projectImagesUrlPath: normalizeUrlPath(process.env.PROJECT_IMAGES_URL_PATH, '/project-images'),
    equipmentUploadsUrlPath: normalizeUrlPath(process.env.EQUIPMENT_UPLOADS_URL_PATH, '/uploads/equipment'),
    visitorSignaturesUrlPath: normalizeUrlPath(process.env.VISITOR_SIGNATURES_URL_PATH, '/uploads/visitors')
  }
};
