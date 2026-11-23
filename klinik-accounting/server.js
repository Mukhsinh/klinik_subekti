import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load .env secara otomatis jika ada
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const PORT = process.env.PORT || 3003;
const distPath = path.join(__dirname, 'dist');

// Cek folder dist
if (!fs.existsSync(distPath)) {
  console.warn('[WARNING] Folder "dist" belum ditemukan.');
  console.warn('[WARNING] Pastikan Anda telah menjalankan: npm run build');
}

// Serve file statis dari direktori dist
app.use(express.static(distPath));

// Health-check endpoint untuk monitoring atau aaPanel
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback: semua route diarahkan ke index.html untuk react-router-dom
app.use((req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send(
      '<h3>Aplikasi sedang dipersiapkan</h3><p>Folder build <code>dist/index.html</code> belum ditemukan. Silakan jalankan perintah <code>npm run build</code> di terminal aaPanel.</p>'
    );
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`[Aplikasi Klinik] Server aktif di http://0.0.0.0:${PORT}`);
  console.log(`[Aplikasi Klinik] Mode: Production`);
  console.log(`===============================================`);
});
