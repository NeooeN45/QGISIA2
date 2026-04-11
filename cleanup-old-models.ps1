# Script de nettoyage des vieux modèles Ollama
# Garde uniquement les petits modèles essentiels

param(
    [string[]]$KeepModels = @("qwen3:4b-instruct-2507-q4_K_M", "llama3.2:1b"),
    [switch]$WhatIf = $false,
    [switch]$Force = $false
)

Write-Host "=== Nettoyage des Modèles Ollama ===" -ForegroundColor Green
Write-Host ""

# Vérifier Ollama
try {
    $ollamaVersion = ollama --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ollama n'est pas accessible" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Ollama détecté : $ollamaVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama n'est pas installé" -ForegroundColor Red
    exit 1
}

# Lister les modèles installés
Write-Host ""
Write-Host "📋 Modèles actuellement installés :" -ForegroundColor Cyan
$installedModels = ollama list | Select-Object -Skip 1 | ForEach-Object {
    $parts = $_ -split "\s+"
    if ($parts.Count -ge 3) {
        [PSCustomObject]@{
            Name = $parts[0]
            ID = $parts[1]
            Size = $parts[2]
            Modified = ($parts[3..($parts.Count-1)] -join " ")
        }
    }
}

$installedModels | Format-Table -AutoSize

# Calculer l'espace total utilisé
try {
    $diskBefore = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeBeforeGB = [math]::Round($diskBefore.FreeSpace / 1GB, 2)
    Write-Host "💾 Espace disque libre actuel : $freeBeforeGB GB" -ForegroundColor Cyan
} catch {
    Write-Host "⚠️  Impossible de récupérer l'espace disque" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🗑️  Modèles à CONSERVER :" -ForegroundColor Green
foreach ($model in $KeepModels) {
    Write-Host "  ✅ $model" -ForegroundColor Green
}

# Identifier les modèles à supprimer
$modelsToRemove = $installedModels | Where-Object { $KeepModels -notcontains $_.Name }

Write-Host ""
Write-Host "🗑️  Modèles à SUPPRIMER :" -ForegroundColor Red
if ($modelsToRemove.Count -eq 0) {
    Write-Host "  (Aucun - tous les modèles sont dans la liste de conservation)" -ForegroundColor Gray
} else {
    foreach ($model in $modelsToRemove) {
        Write-Host "  ❌ $($model.Name) ($($model.Size))" -ForegroundColor Red
    }
}

Write-Host ""
if ($WhatIf) {
    Write-Host "⚠️  Mode simulation (WhatIf) - Aucune suppression réelle" -ForegroundColor Yellow
    exit 0
}

if (-not $Force) {
    $confirmation = Read-Host "⚠️  Êtes-vous sûr de vouloir supprimer ces modèles ? (oui/non)"
    if ($confirmation -ne "oui") {
        Write-Host "Opération annulée." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "⚡ Mode Force activé - Suppression automatique" -ForegroundColor Yellow
}

# Supprimer les modèles
Write-Host ""
Write-Host "🚀 Suppression en cours..." -ForegroundColor Cyan
Write-Host ""

$removed = @()
$failed = @()
$spaceFreed = 0

foreach ($model in $modelsToRemove) {
    Write-Host "🗑️  Suppression de $($model.Name)..." -ForegroundColor Gray -NoNewline
    try {
        ollama rm $model.Name 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor Green
            $removed += $model.Name
            
            # Essayer d'extraire la taille (approximatif)
            $sizeStr = $model.Size
            if ($sizeStr -match "([\d.]+)\s*GB") {
                $spaceFreed += [double]$matches[1]
            } elseif ($sizeStr -match "([\d.]+)\s*MB") {
                $spaceFreed += [double]$matches[1] / 1024
            }
        } else {
            Write-Host " ❌" -ForegroundColor Red
            $failed += $model.Name
        }
    } catch {
        Write-Host " ❌ (Erreur: $_)" -ForegroundColor Red
        $failed += $model.Name
    }
}

# Calculer le nouvel espace disque
try {
    $diskAfter = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeAfterGB = [math]::Round($diskAfter.FreeSpace / 1GB, 2)
    $spaceFreedGB = [math]::Round($spaceFreed, 2)
    
    Write-Host ""
    Write-Host "💾 Espace disque :" -ForegroundColor Cyan
    Write-Host "  Avant : $freeBeforeGB GB" -ForegroundColor Gray
    Write-Host "  Après : $freeAfterGB GB" -ForegroundColor Green
    Write-Host "  Libéré : ~$spaceFreedGB GB" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "💾 Espace estimé libéré : ~$([math]::Round($spaceFreed, 2)) GB" -ForegroundColor Green
}

# Résumé
Write-Host ""
Write-Host "=== RÉSUMÉ ===" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Modèles supprimés ($($removed.Count)) :" -ForegroundColor Green
foreach ($model in $removed) {
    Write-Host "  • $model" -ForegroundColor Green
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Échecs ($($failed.Count)) :" -ForegroundColor Red
    foreach ($model in $failed) {
        Write-Host "  • $model" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "✅ Modèles conservés :" -ForegroundColor Green
$remainingModels = ollama list | Select-String "^NAME" -NotMatch | ForEach-Object { ($_ -split "\s+")[0] }
foreach ($model in $remainingModels) {
    if ($model -and ($KeepModels -contains $model)) {
        Write-Host "  • $model" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "🎯 Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Lancez test-hf-models.ps1 pour tester Gemma 4" -ForegroundColor White
Write-Host "2. Ou installez directement : ollama pull gemma2:4b" -ForegroundColor White
Write-Host ""
Write-Host "💡 Pour libérer encore plus d'espace, modifiez la liste KeepModels:" -ForegroundColor Gray
Write-Host "   .\cleanup-old-models.ps1 -KeepModels @('qwen3:4b-instruct-2507-q4_K_M')" -ForegroundColor Gray
Write-Host ""
