const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const mongoose = require('mongoose');
const multer = require('multer');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const Bay = require('./models/BayModel');
require('dotenv').config();
const config = require('./config/config');

const app = express();
const PORT = config.server.port;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!MONGO_URI) {
  console.error('ERROR: No MongoDB URI configured. Set MONGO_URI or MONGODB_URI in your .env file.');
  process.exit(1);
}

// Keep startup snappy: short timeouts and IPv4 to avoid long DNS fallbacks
const mongooseOptions = {
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 5000,
  socketTimeoutMS: 30000,
  maxPoolSize: 10,
  family: 4
};

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger);

const UPLOAD_MAX_MB = Number.parseInt(process.env.UPLOAD_MAX_MB || '100', 10);
const UPLOAD_MAX_BYTES = (Number.isFinite(UPLOAD_MAX_MB) ? UPLOAD_MAX_MB : 100) * 1024 * 1024;
const MEDIA_ROOT = config.media.projectImagesDir;
const MEDIA_ROOT_RESOLVED = path.resolve(MEDIA_ROOT);
const MEDIA_URL_PREFIX = config.media.projectImagesUrlPath;
const MEDIA_EXT_RE = /\.(jpg|jpeg|png|gif|webp|mp4|mov|webm|m4v|avi)$/i;
const PHASE_FOLDERS = {
  entry: 'entry',
  progress: 'progress',
  exit: 'exit-delivery',
  delivery: 'exit-delivery',
  'exit delivery': 'exit-delivery',
  'exit/delivery': 'exit-delivery',
  'exit-delivery': 'exit-delivery'
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const joinUrl = (...parts) => {
  const cleaned = parts
    .filter((part) => part !== undefined && part !== null)
    .map((part, index) => {
      const value = String(part);
      if (index === 0) return value.replace(/\/+$/, '');
      return value.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean);
  return cleaned.join('/');
};

const sanitizeSegment = (value) => {
  if (!value) return 'unknown';
  return value.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'unknown';
};

const normalizePhase = (value) => {
  const raw = (value || '').toString().trim().toLowerCase();
  if (!raw) return 'unspecified';
  if (PHASE_FOLDERS[raw]) return PHASE_FOLDERS[raw];
  const compact = raw.replace(/[^a-z]/g, '');
  if (compact === 'entry') return 'entry';
  if (compact === 'progress') return 'progress';
  if (compact === 'exit' || compact === 'exitdelivery') return 'exit-delivery';
  return 'unspecified';
};

ensureDir(MEDIA_ROOT);
app.use(MEDIA_URL_PREFIX, express.static(MEDIA_ROOT));
app.use(config.media.equipmentUploadsUrlPath, express.static(config.media.equipmentUploadsDir));
app.use(config.media.visitorSignaturesUrlPath, express.static(config.media.visitorSignaturesDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const bayMatch = file.fieldname.match(/^photo_bay([1-6])$/);
      if (bayMatch) {
        const bayNum = bayMatch[1];
        const rawProject = (req.body && req.body.projectName) || (req.query && req.query.projectName) || '';
        const rawPhase = (req.body && req.body.phase) || (req.query && req.query.phase) || '';
        const projectName = sanitizeSegment(rawProject);
        const phaseFolder = normalizePhase(rawPhase);
        const dest = path.join(MEDIA_ROOT, `bay${bayNum}`, projectName || 'unknown', phaseFolder);
        ensureDir(dest);
        return cb(null, dest);
      }

      const directMatch = file.fieldname.match(/^photo_direct_(.+)_(.+)$/);
      if (directMatch) {
        let tech = directMatch[1];
        let project = directMatch[2];
        const rawPhase = (req.body && req.body.phase) || (req.query && req.query.phase) || '';
        try {
          tech = decodeURIComponent(tech);
        } catch {
          tech = tech;
        }
        try {
          project = decodeURIComponent(project);
        } catch {
          project = project;
        }
        const phaseFolder = normalizePhase(rawPhase);
        const dest = path.join(MEDIA_ROOT, 'direct', sanitizeSegment(tech), sanitizeSegment(project), phaseFolder);
        ensureDir(dest);
        return cb(null, dest);
      }

      const dest = path.join(MEDIA_ROOT, 'unknown');
      ensureDir(dest);
      return cb(null, dest);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `${Date.now()}${ext}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      return cb(new Error('Only image or video files are allowed'));
    }
    return cb(null, true);
  },
  limits: { fileSize: UPLOAD_MAX_BYTES }
});

const collectFiles = (dir, urlPrefix) => {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    if (entry.isDirectory()) {
      files.push(...collectFiles(path.join(dir, entry.name), `${urlPrefix}/${entry.name}`));
    } else if (entry.isFile() && MEDIA_EXT_RE.test(entry.name)) {
      files.push(`${urlPrefix}/${entry.name}`);
    }
  });
  return files;
};

const resolveMediaPath = (urlPath) => {
  const expectedPrefix = `${MEDIA_URL_PREFIX}/`;
  if (typeof urlPath !== 'string' || !urlPath.startsWith(expectedPrefix)) return null;
  const relativePath = urlPath.slice(expectedPrefix.length);
  const absolutePath = path.resolve(MEDIA_ROOT, relativePath);
  if (!absolutePath.startsWith(MEDIA_ROOT_RESOLVED)) return null;
  return absolutePath;
};

// API Routes
app.use('/api/bays', require('./routes/api/bays'));
app.use('/api/technicians', require('./routes/api/technicians'));
app.use('/api/direct-projects', require('./routes/api/directProjects'));
app.use('/api/finished-projects', require('./routes/api/finishedProjects'));
app.use('/api/equipment', require('./routes/api/equipment'));
app.use('/api/visitors', require('./routes/api/visitors'));
app.use('/api/job-costing', require('./routes/api/jobCosting'));
app.use('/api/preplanned-projects', require('./routes/api/preplannedProjects'));
app.use('/api/planner', require('./routes/api/planner'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/bay1', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay1.html'));
});

app.get('/bay2', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay2.html'));
});

app.get('/bay3', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay3.html'));
});

app.get('/bay4', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay4.html'));
});

app.get('/bay5', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay5.html'));
});

app.get('/bay6', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'bay6.html'));
});

app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'manage.html'));
});

app.get('/delays', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'delays.html'));
});

app.get('/finished-projects', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'finished.html'));
});

app.get('/equipment', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'equipment.html'));
});

app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'mobile.html'));
});

app.get('/gallery', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

app.get('/job-costing', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'job-costing.html'));
});

// Pre-Planner React SPA (built with Vite)
const preplannerDistDir = path.join(__dirname, 'preplanner-ui', 'dist');
app.use('/preplanner/assets', express.static(path.join(preplannerDistDir, 'assets')));
app.get('/preplanner', (req, res) => {
  res.sendFile(path.join(preplannerDistDir, 'index.html'));
});

app.get('/visitors', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'visitors.html'));
});

app.get('/visitor-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'visitor-form.html'));
});

app.get('/workshop-visitor-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'workshop-visitor-form.html'));
});

// Simple alerts stub to avoid HTML 404 responses
app.get('/alerts', (_req, res) => {
  res.json({ alerts: [] });
});

// Fallback data endpoint used by frontend when /api/bays is unavailable
app.get('/data', async (_req, res) => {
  try {
    const bays = await Bay.find().sort({ bayNumber: 1 }).lean();
    const map = new Map(bays.map(b => [b.bayNumber, b]));
    const quadrants = Array.from({ length: 6 }, (_, idx) => {
      const b = map.get(idx + 1);
      if (!b) return { bay: idx + 1 };
      return {
        projectName: b.projectName || '',
        assignedPerson: b.assignedTeam || [],
        timer: b.timer || { start: null, end: null },
        paused: Boolean(b.paused),
        pausedAt: b.pausedAt || null,
        currentPauseReason: b.currentPauseReason || '',
        pauseEvents: b.pauseEvents || [],
        movedToDirect: Boolean(b.movedToDirect),
        currentProjectType: b.currentProjectType || 'bay',
        directProject: b.directProject || null,
        directProjectId: b.directProjectId || null,
        displacedProject: b.displacedProject || null,
        bay: b.bayNumber,
        excludedDays: b.excludedDays || []
      };
    });
    res.json({ quadrants });
  } catch (err) {
    console.error('Failed to serve /data', err);
    res.json({ quadrants: [] });
  }
});

for (let i = 1; i <= 6; i++) {
  app.post(`/upload-photo/bay${i}`, (req, res) => {
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const file = req.files[0];
      return res.status(200).json({ message: 'Upload complete', filename: file.filename });
    });
  });
}

app.post('/upload-photo/direct', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const file = req.files[0];
    return res.status(200).json({ message: 'Upload complete', filename: file.filename });
  });
});

app.get('/project-images-structure', (_req, res) => {
  const structure = { bays: {}, direct: {} };

  for (let i = 1; i <= 6; i++) {
    const bayDir = path.join(MEDIA_ROOT, `bay${i}`);
    if (!fs.existsSync(bayDir)) continue;
    structure.bays[`bay${i}`] = {};
    const projects = fs.readdirSync(bayDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    projects.forEach((projectDir) => {
      const projPath = path.join(bayDir, projectDir.name);
      const files = collectFiles(projPath, joinUrl(MEDIA_URL_PREFIX, `bay${i}`, projectDir.name));
      if (files.length) {
        structure.bays[`bay${i}`][projectDir.name] = files;
      }
    });
  }

  const directDir = path.join(MEDIA_ROOT, 'direct');
  if (fs.existsSync(directDir)) {
    const techDirs = fs.readdirSync(directDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
    techDirs.forEach((techDir) => {
      const techPath = path.join(directDir, techDir.name);
      const projectDirs = fs.readdirSync(techPath, { withFileTypes: true }).filter((entry) => entry.isDirectory());
      projectDirs.forEach((projectDir) => {
        const projPath = path.join(techPath, projectDir.name);
        const files = collectFiles(projPath, joinUrl(MEDIA_URL_PREFIX, 'direct', techDir.name, projectDir.name));
        if (files.length) {
          if (!structure.direct[techDir.name]) structure.direct[techDir.name] = {};
          structure.direct[techDir.name][projectDir.name] = files;
        }
      });
    });
  }

  res.json(structure);
});

app.post('/download-media', (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  if (!files.length) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const archiveNameRaw = typeof req.body?.archiveName === 'string' ? req.body.archiveName : 'media-download';
  const archiveName = sanitizeSegment(archiveNameRaw) || 'media-download';

  const entries = files.map((fileUrl) => {
    const absolutePath = resolveMediaPath(fileUrl);
    if (!absolutePath || !fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;
    const name = path.relative(MEDIA_ROOT, absolutePath);
    return { absolutePath, name };
  }).filter(Boolean);

  if (!entries.length) {
    return res.status(400).json({ error: 'No valid files found' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${archiveName}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('Archive error', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to create archive' });
    } else {
      res.end();
    }
  });

  res.on('close', () => {
    archive.destroy();
  });

  archive.pipe(res);
  entries.forEach((entry) => {
    archive.file(entry.absolutePath, { name: entry.name });
  });
  archive.finalize();
});

// API 404 handler to avoid HTML responses on bad routes
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler to enforce JSON error responses
app.use(errorHandler);

async function startServer() {
  try {
    console.log(`Connecting to MongoDB at ${MONGO_URI} ...`);
    await mongoose.connect(MONGO_URI, mongooseOptions);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`BayMaster server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
    process.exit(1);
  }
}

startServer();
