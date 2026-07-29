import fs from 'fs';
import path from 'path';

const csvPath = path.resolve('public/Master inventory.csv');
const text = fs.readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

console.log('Total non-empty lines:', lines.length);
console.log('Header line:', lines[0]);

const headers = lines[0].split(';').map(h => h.trim());
console.log('Headers parsed:', headers);

const rows = lines.slice(1).map((line, idx) => {
    const parts = line.split(';').map(p => p.trim());
    return {
        lineNum: idx + 2,
        kode: parts[0] || '',
        nama: parts[1] || '',
        bentuk: parts[2] || '',
        golongan: parts[3] || '',
        kelas_terapi: parts[4] || '',
        kandungan: parts[5] || '',
        kategori: parts[6] || ''
    };
});

console.log('Sample row 1:', rows[0]);
console.log('Sample row 2:', rows[1]);

const uniqueBentuk = [...new Set(rows.map(r => r.bentuk))];
const uniqueGolongan = [...new Set(rows.map(r => r.golongan))];
const uniqueKelasTerapi = [...new Set(rows.map(r => r.kelas_terapi))];
const uniqueKategori = [...new Set(rows.map(r => r.kategori))];

console.log('Unique Bentuk:', uniqueBentuk);
console.log('Unique Golongan:', uniqueGolongan);
console.log('Unique Kelas Terapi:', uniqueKelasTerapi);
console.log('Unique Kategori:', uniqueKategori);

// Check if any KODE is present in CSV or empty
const codedCount = rows.filter(r => r.kode).length;
console.log(`Rows with KODE: ${codedCount} out of ${rows.length}`);
