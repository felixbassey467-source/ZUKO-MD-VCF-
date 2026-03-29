const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// Ensure private storage directory exists
const STORAGE_DIR = path.join(__dirname, 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MAIN ENDPOINT: receive VCF data from frontend
app.post('/api/vcf/private-submit', (req, res) => {
  try {
    const { fullName, phoneNumber, vcfContent, submittedAt, userAgent } = req.body;
    
    console.log(`[RECEIVED] Submission from: ${fullName} (${phoneNumber})`);
    
    if (!fullName || !phoneNumber) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }
    if (!vcfContent) {
      return res.status(400).json({ error: 'Missing VCF content' });
    }
    
    // generate unique filename for admin
    const timestamp = Date.now();
    const safeName = fullName.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
    const filename = `ZUKO_${safeName}_${timestamp}.vcf`;
    const filePath = path.join(STORAGE_DIR, filename);
    
    // Write VCF file to disk
    fs.writeFileSync(filePath, vcfContent, 'utf8');
    
    // Store metadata log for admin reference
    const metadata = {
      id: timestamp,
      fullName,
      phoneNumber,
      savedFile: filename,
      submittedAt: submittedAt || new Date().toISOString(),
      userAgent: userAgent || 'unknown',
      ip: req.ip || req.socket.remoteAddress
    };
    
    const logPath = path.join(STORAGE_DIR, 'submissions_log.json');
    let logs = [];
    if (fs.existsSync(logPath)) {
      try {
        logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      } catch(e) { logs = []; }
    }
    logs.push(metadata);
    fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
    
    console.log(`[STORED] VCF saved: ${filename} from ${fullName} (${phoneNumber})`);
    
    res.json({ 
      success: true, 
      message: 'VCF securely saved. Only administrator can access the file.',
      reference: filename
    });
  } catch (err) {
    console.error('Storage error:', err);
    res.status(500).json({ error: 'Internal server error: could not save VCF' });
  }
});

// Admin-only endpoint to view all stored VCF files (optional - protect with token)
app.get('/api/admin/list', (req, res) => {
  const adminToken = req.query.token;
  const expectedToken = process.env.ADMIN_TOKEN;
  
  // If no token set in env, only allow localhost or you can comment this
  if (expectedToken && adminToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.vcf'));
    const logsPath = path.join(STORAGE_DIR, 'submissions_log.json');
    let submissions = [];
    if (fs.existsSync(logsPath)) {
      submissions = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
    }
    res.json({ 
      count: files.length, 
      files: files,
      submissions: submissions
    });
  } catch(e) { 
    res.status(500).json({ error: 'Cannot list files' }); 
  }
});

// Admin endpoint to download a specific VCF file
app.get('/api/admin/download/:filename', (req, res) => {
  const adminToken = req.query.token;
  const expectedToken = process.env.ADMIN_TOKEN;
  
  if (expectedToken && adminToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const filename = req.params.filename;
  const filePath = path.join(STORAGE_DIR, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 ZUKO-MD PRIVATE VCF backend running on port ${PORT}`);
  console.log(`📁 VCF files stored in: ${STORAGE_DIR}`);
  console.log(`🌐 Frontend available at: http://localhost:${PORT}`);
});