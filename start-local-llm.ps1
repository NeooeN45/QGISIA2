param(
  [string]$Model = "qwen3:4b-instruct-2507-q4_K_M",
  [string]$Endpoint = "http://127.0.0.1:11434"
)

$ollamaExe = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"

if (-not (Test-Path $ollamaExe)) {
  throw "Ollama est introuvable: $ollamaExe"
}

function Wait-Ollama {
  param([int]$TimeoutSeconds = 20)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-RestMethod -Uri "$Endpoint/api/tags" -TimeoutSec 3 | Out-Null
      return $true
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

if (-not (Wait-Ollama -TimeoutSeconds 2)) {
  Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden | Out-Null
  if (-not (Wait-Ollama)) {
    throw "Impossible de demarrer Ollama sur $Endpoint"
  }
}

$models = Invoke-RestMethod -Uri "$Endpoint/api/tags" -TimeoutSec 10
$hasModel = @($models.models | Where-Object { $_.name -eq $Model }).Count -gt 0

if (-not $hasModel) {
  & $ollamaExe pull $Model
}

$payload = @{
  model = $Model
  prompt = "Reponds en une phrase: LLM local pret."
  stream = $false
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "$Endpoint/api/generate" -Method Post -ContentType "application/json" -Body $payload -TimeoutSec 120

[pscustomobject]@{
  endpoint = "$Endpoint/api/generate"
  model = $Model
  response = $response.response
} | Format-List
