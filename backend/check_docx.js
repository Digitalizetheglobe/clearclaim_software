const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const filePath = path.join(__dirname, 'temp_form_b.docx');
console.log('File exists:', fs.existsSync(filePath));

// Use powershell to extract document.xml
try {
  const xml = execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [System.IO.Compression.ZipFile]::OpenRead('${filePath}'); $entry = $zip.GetEntry('word/document.xml'); if ($entry) { $stream = $entry.Open(); $reader = New-Object System.IO.StreamReader($stream); $xml = $reader.ReadToEnd(); $reader.Close(); $stream.Close(); $xml } $zip.Dispose()"`, { encoding: 'utf8' });
  
  if (xml.includes('<w:tblpPr')) {
    console.log('Floating table found! <w:tblpPr> exists.');
    const matches = xml.match(/<w:tblpPr[^>]*\/>|<w:tblpPr>.*?<\/w:tblpPr>/g);
    console.log('Matches:', matches);
  } else {
    console.log('No floating tables found (<w:tblpPr>). Checking for Text Boxes (w:drawing, v:shape)...');
    
    if (xml.includes('<w:drawing')) console.log('Contains w:drawing elements.');
    if (xml.includes('<v:shape')) console.log('Contains v:shape (VML) elements.');
    if (xml.includes('mc:AlternateContent')) console.log('Contains mc:AlternateContent (often used for text boxes).');
  }
} catch (e) {
  console.error('Error:', e);
}
