const express = require('express');
 const fs = require('fs');
 const path = require('path');
 const cors = require('cors');
 const app = express();
 const PORT = process.env.PORT || 3000;
 
 // ensure storage directory exists
 const STORAGE_DIR = path.join(__dirname, 'storage');
 if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
 
 app.use(cors());
 app.use(express.json({ limit: '5mb' }));
 app.use(express.static(path.join(__dirname, 'public')));
 
 // endpoint to receive VCF data from frontend
 app.post('/api/vcf/create', (req, res) => {
   try {
     const { name, phone, organization, email, title, vcfContent, generatedAt } = req.body;
     if (!name || !phone) {
       return res.status(400).json({ error: 'Name and phone are required' });
     }
     // generate safe filename
     const timestamp = Date.now();
     const safeName = name.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
     const filename = `ZUKO_${safeName}_${timestamp}.vcf`;
     const filePath = path.join(STORAGE_DIR, filename);
     
     // write actual vcf file to disk
     fs.writeFileSync(filePath, vcfContent || '', 'utf8');
     
     // also log metadata (optional)
     const metaLog = {
       originalName: name,
       phone,
       organization: organization || '',
       email: email || '',
       title: title || '',
       savedFile: filename,
       receivedAt: generatedAt || new Date().toISOString()
     };
     const logPath = path.join(STORAGE_DIR, 'metadata_log.json');
     let logs = [];
     if (fs.existsSync(logPath)) {
       logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));
     }
     logs.push(metaLog);
     fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
     
     console.log(`✅ VCF saved: ${filename} from ${name}`);
     res.json({ success: true, message: 'VCF received and stored', file: filename });
   } catch (err) {
     console.error('backend error:', err);
     res.status(500).json({ error: 'Internal server error' });
   }
 });
 
 // optional: endpoint to list stored VCFs (private/admin)
 app.get('/api/vcf/list', (req, res) => {
   try {
     const files = fs.readdirSync(STORAGE_DIR).filter(f => f.endsWith('.vcf'));
     res.json({ count: files.length, files });
   } catch(e) { res.status(500).json({ error: 'cannot list' }); }
 });
 
 app.listen(PORT, () => {
   console.log(`🚀 ZUKO-MD backend running on port ${PORT}`);
   console.log(`📁 VCF storage: ${STORAGE_DIR}`);
 });