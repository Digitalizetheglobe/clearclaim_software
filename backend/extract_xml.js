const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const filePath = path.join(__dirname, 'temp_form_b.docx');

try {
  const xml = execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath}'); $entry = $zip.GetEntry('word/document.xml'); if ($entry) { $stream = $entry.Open(); $reader = New-Object System.IO.StreamReader($stream); $xml = $reader.ReadToEnd(); $reader.Close(); $stream.Close(); $xml } $zip.Dispose()"`, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 });
  
  // Save the XML so we can inspect it
  fs.writeFileSync('temp_form_b_doc.xml', xml);
  console.log('XML extracted to temp_form_b_doc.xml');
} catch (e) {
  console.error('Error:', e);
}
