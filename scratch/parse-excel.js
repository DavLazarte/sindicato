const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'RETENCIONES MES DE ABRIL 2026.xlsx');
const wb = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(wb.SheetNames);

wb.SheetNames.forEach(name => {
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n========== Sheet: "${name}" ==========`);
  console.log('Total rows:', data.length);
  
  // Print first 30 rows to understand structure
  data.slice(0, 30).forEach((row, i) => {
    console.log(`Row ${i}: ${JSON.stringify(row)}`);
  });
  
  // Print last 5 rows for totals
  if (data.length > 30) {
    console.log('\n--- LAST 5 ROWS ---');
    data.slice(-5).forEach((row, i) => {
      console.log(`Row ${data.length - 5 + i}: ${JSON.stringify(row)}`);
    });
  }

  // Print merge info
  if (ws['!merges']) {
    console.log('\n--- MERGES ---');
    ws['!merges'].forEach(m => console.log(JSON.stringify(m)));
  }

  // Print formulas
  const formulas = Object.keys(ws).filter(k => ws[k] && ws[k].f);
  if (formulas.length > 0) {
    console.log('\n--- FORMULAS (first 20) ---');
    formulas.slice(0, 20).forEach(k => console.log(`${k}: =${ws[k].f}`));
  }
});
