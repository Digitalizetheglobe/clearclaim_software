$dir = "c:\Users\DIMPAL\OneDrive\Desktop\matrixxx\clearclaim_software\backend\templates"
$files = Get-ChildItem -Path $dir -Filter "*.docx"

Add-Type -AssemblyName System.IO.Compression.FileSystem

foreach ($file in $files) {
    if ($file.Name.StartsWith("~$")) { continue }
    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($file.FullName)
        $entry = $zip.GetEntry("word/document.xml")
        if ($entry) {
            $stream = $entry.Open()
            $reader = New-Object System.IO.StreamReader($stream)
            $xml = $reader.ReadToEnd()
            $reader.Close()
            $stream.Close()
            
            $text = $xml -replace '<[^>]*>', ''
            
            $hasMatch = $false
            if ($text -match "Address Contact") { $hasMatch = $true }
            if ($text -match "\[Address C") { $hasMatch = $true }
            if ($text -match "Name as per Aadhar C1") { $hasMatch = $true }
            
            if ($hasMatch) {
                Write-Host "Match found in: $($file.Name)"
                if ($text -match "\[Address Contact C1\]") { Write-Host "  -> Has [Address Contact C1]" }
                if ($text -match "\[Address C1\]") { Write-Host "  -> Has [Address C1]" }
                if ($text -match "\[Name as per Aadhar C1\]") { Write-Host "  -> Has [Name as per Aadhar C1]" }
            }
        }
        $zip.Dispose()
    } catch {
        # Ignore
    }
}
