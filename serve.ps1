param(
  [int]$Port = 4173,
  [string]$Root = $PSScriptRoot
)

Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.mjs'  = 'application/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
  '.map'  = 'application/json; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Output "FAILED TO START: $($_.Exception.Message)"
  exit 1
}

Write-Output "Serving '$Root' at $prefix"

while ($listener.IsListening) {
  $context = $listener.GetContext()
  $request = $context.Request
  $response = $context.Response

  try {
    $relPath = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
    if ([string]::IsNullOrWhiteSpace($relPath)) { $relPath = 'index.html' }

    $fullPath = Join-Path $Root $relPath
    $fullPath = [System.IO.Path]::GetFullPath($fullPath)

    if (-not $fullPath.StartsWith([System.IO.Path]::GetFullPath($Root))) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }

    if (Test-Path $fullPath -PathType Container) {
      $fullPath = Join-Path $fullPath 'index.html'
    }

    if (Test-Path $fullPath -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = $mime[$ext]
      if (-not $contentType) { $contentType = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
      $response.ContentType = $contentType
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
      $notFound = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $relPath")
      $response.ContentType = 'text/plain'
      $response.OutputStream.Write($notFound, 0, $notFound.Length)
    }
  } catch {
    try {
      $response.StatusCode = 500
      $err = [System.Text.Encoding]::UTF8.GetBytes("500: $($_.Exception.Message)")
      $response.OutputStream.Write($err, 0, $err.Length)
    } catch {}
  } finally {
    $response.Close()
  }
}
