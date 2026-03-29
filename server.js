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
  
  // ENDPOINT: receive VCF data from frontend (users submit name + number)
  // Admin only can access the /storage folder via shell or custom endpoint.
  app.post('/api/vcf/private-submit', (req, res) => {
    try {
      const { fullName, phoneNumber, vcfContent, submittedAt, userAgent } = req.body;
      
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
      
      // Write VCF file to disk (only admin can access via Render shell or secure route)
      fs.writeFileSync(filePath, vcfContent, 'utf8');
      
      // Also store metadata log for admin reference
      const metadata = {
        id: timestamp,
        fullName,
        phoneNumber,
        savedFile: filename,
        submittedAt: submittedAt || new Date().toISOString(),
        userAgent: userAgent || 'unknown'
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
      
      console.log(`[PRIVATE] VCF stored: ${filename} from ${fullName} (${phoneNumber})`);
      
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