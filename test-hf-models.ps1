# Script de test "One-by-One" pour Gemma 4 via Ollama
# Installe → Teste → Note → Supprime → Passe au suivant

# Optimisation vitesse de téléchargement Ollama
$env:OLLAMA_MAX_DOWNLOAD_CONCURRENCY = 8  # Téléchargements parallèles max
$env:OLLAMA_KEEP_ALIVE = "0"              # Ne garde pas le modèle en RAM après test

# Modèles Gemma 4 disponibles sur Ollama (noms officiels vérifiés)
# E = "Effective parameters" (per-layer embeddings), MoE = Mixture of Experts
$modelsToTest = @(
    @{
        Name = "gemma4:e2b"       # Effective 2B — 7.2 GB, context 128K
        Label = "Gemma 4 E2B"
        SizeGB = 8
    },
    @{
        Name = "gemma4:e4b"       # Effective 4B (= latest) — 9.6 GB, context 128K
        Label = "Gemma 4 E4B (default)"
        SizeGB = 11
    },
    @{
        Name = "gemma4:26b"       # 26B MoE, actifs 4B — 18 GB, context 256K
        Label = "Gemma 4 26B MoE"
        SizeGB = 20
    },
    @{
        Name = "gemma4:31b"       # 31B dense — 20 GB, context 256K
        Label = "Gemma 4 31B"
        SizeGB = 22
    }
)

$testPrompts = @(
    "Explique comment créer une couche vectorielle dans QGIS en 3 étapes.",
    "Écris un script Python PyQGIS pour bufferiser une couche vectorielle de 500 mètres.",
    "Quelle est la différence entre un système de coordonnées projeté et géographique ?"
)

# Teste un modèle via l'API Ollama locale
function Invoke-OllamaPrompt {
    param([string]$ModelName, [string]$Prompt)

    $body = @{
        model  = $ModelName
        prompt = $Prompt
        stream = $false
        options = @{ temperature = 0.7; num_predict = 512 }
    } | ConvertTo-Json

    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/generate" `
            -Method Post -ContentType "application/json" -Body $body -TimeoutSec 180
        $duration = ((Get-Date) - $startTime).TotalSeconds
        return @{ Success = $true; Response = $response.response; Duration = $duration }
    } catch {
        return @{ Success = $false; Error = $_.Exception.Message; Duration = 0 }
    }
}

# Fonction pour noter un modèle
function Get-ModelRating {
    param($Label, $Responses, $Durations)
    
    Write-Host ""
    Write-Host "=== NOTATION pour $Label ===" -ForegroundColor Cyan
    Write-Host ""
    
    $score = 0
    
    # Qualité (1-10)
    $quality = Read-Host "Qualité globale des réponses (1-10)"
    $score += ([int]$quality * 3)
    
    # Vitesse (1-10)
    $avgDuration = ($Durations | Measure-Object -Average).Average
    Write-Host "Temps moyen de réponse : $([math]::Round($avgDuration, 2)) secondes" -ForegroundColor Gray
    $speed = Read-Host "Vitesse de génération (1-10, 10=très rapide)"
    $score += ([int]$speed * 2)
    
    # Pertinence QGIS (1-10)
    $relevance = Read-Host "Pertinence pour QGIS/SIG (1-10)"
    $score += ([int]$relevance * 3)
    
    # Facilité d'utilisation (1-10)
    $ease = Read-Host "Facilité d'utilisation (1-10)"
    $score += ([int]$ease * 2)
    
    return @{
        Model = $Label
        Quality = [int]$quality
        Speed = [int]$speed
        Relevance = [int]$relevance
        Ease = [int]$ease
        TotalScore = $score
        AvgDuration = $avgDuration
        Notes = Read-Host "Notes additionnelles (facultatif)"
    }
}

# Sauvegarde les résultats dans un fichier JSON
function Save-TestResults {
    param($Results)
    $path = Join-Path $PSScriptRoot "gemma4-test-results.json"
    $Results | ConvertTo-Json -Depth 4 | Out-File -FilePath $path -Encoding UTF8
    Write-Host "✅ Résultats sauvegardés : $path" -ForegroundColor Green
}

# === MAIN ===

Write-Host "=== Test Gemma 4 via Ollama (One-by-One) ===" -ForegroundColor Green
Write-Host "Mode: Installe → Teste → Note → Supprime → Suivant" -ForegroundColor Gray
Write-Host ""

# Vérifier qu'Ollama est démarré
try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
    Write-Host "✅ Ollama est démarré" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama n'est pas démarré. Lance 'ollama serve' d'abord." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "📋 Modèles à tester :" -ForegroundColor Cyan
foreach ($model in $modelsToTest) {
    Write-Host "  • $($model.Label) — $($model.Name) (~$($model.SizeGB) GB)" -ForegroundColor White
}

Write-Host ""
$confirmation = Read-Host "⚠️  Chaque modèle sera installé, testé puis supprimé. Continuer ? (oui/non)"
if ($confirmation -ne "oui") { Write-Host "Test annulé." -ForegroundColor Yellow; exit 0 }

$allResults = [System.Collections.ArrayList]@()

foreach ($model in $modelsToTest) {
    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "  TEST : $($model.Label)" -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan

    # 1. Vérifier l'espace disque
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    Write-Host "💾 Espace libre : $freeSpaceGB GB (besoin : $($model.SizeGB + 2) GB)" -ForegroundColor Gray

    if ($freeSpaceGB -lt ($model.SizeGB + 2)) {
        Write-Host "❌ Espace insuffisant — modèle ignoré." -ForegroundColor Red
        continue
    }

    # 2. Télécharger le modèle (avec mesure du temps)
    Write-Host ""
    Write-Host "📥 Téléchargement de $($model.Name) ($($model.SizeGB) GB)..." -ForegroundColor Yellow
    Write-Host "   Astuce : ferme les autres apps pour maximiser la bande passante" -ForegroundColor DarkGray
    $dlStart = Get-Date
    ollama pull $($model.Name)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Échec du téléchargement." -ForegroundColor Red
        continue
    }
    $dlSec = [math]::Round(((Get-Date) - $dlStart).TotalSeconds)
    $dlMBps = [math]::Round(($model.SizeGB * 1024) / $dlSec, 1)
    Write-Host "✅ Téléchargé en ${dlSec}s (~${dlMBps} MB/s)" -ForegroundColor Green

    # 3. Envoyer les prompts de test
    Write-Host ""
    Write-Host "🧪 Envoi des prompts de test..." -ForegroundColor Cyan
    $responses = [System.Collections.ArrayList]@()
    $durations = [System.Collections.ArrayList]@()

    foreach ($prompt in $testPrompts) {
        Write-Host "  → $prompt" -ForegroundColor Gray
        $result = Invoke-OllamaPrompt -ModelName $model.Name -Prompt $prompt

        if ($result.Success) {
            $null = $responses.Add($result.Response)
            $null = $durations.Add($result.Duration)
            $preview = if ($result.Response.Length -gt 120) { $result.Response.Substring(0, 120) + "..." } else { $result.Response }
            Write-Host "  ✅ $([math]::Round($result.Duration, 1))s  |  $preview" -ForegroundColor DarkGray
        } else {
            Write-Host "  ❌ Erreur: $($result.Error)" -ForegroundColor Red
        }
        Write-Host ""
    }

    # 4. Notation interactive
    if ($responses.Count -gt 0) {
        $scoreResult = Get-ModelRating -Label $model.Label -Responses $responses -Durations $durations
        $null = $allResults.Add($scoreResult)
        Write-Host ""
        Write-Host "📊 Score $($model.Label) : $($scoreResult.TotalScore)/100" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Aucune réponse valide — pas de notation." -ForegroundColor Yellow
    }

    # 5. Supprimer le modèle pour libérer l'espace
    Write-Host ""
    Write-Host "🗑️  Suppression de $($model.Name)..." -ForegroundColor Yellow
    ollama rm $($model.Name) 2>&1 | Out-Null
    Write-Host "✅ Modèle supprimé." -ForegroundColor Green

    Write-Host ""
    Read-Host "Appuyez sur Entrée pour continuer avec le modèle suivant..."
}

# 6. Sauvegarder les résultats
Save-TestResults -Results $allResults

# 7. Classement final
Write-Host ""
Write-Host "=== CLASSEMENT FINAL ===" -ForegroundColor Green
Write-Host ""

if ($allResults.Count -eq 0) {
    Write-Host "⚠️  Aucun modèle testé avec succès." -ForegroundColor Yellow
    exit 0
}

$ranking = $allResults | Sort-Object -Property TotalScore -Descending
$position = 1
foreach ($result in $ranking) {
    $color = switch ($position) { 1 { "Green" } 2 { "Yellow" } default { "Gray" } }
    Write-Host "$position. $($result.Model) — Score: $($result.TotalScore)/100" -ForegroundColor $color
    Write-Host "   Qualité: $($result.Quality)/10 | Vitesse: $($result.Speed)/10 | Pertinence: $($result.Relevance)/10" -ForegroundColor Gray
    if ($result.Notes) { Write-Host "   Notes: $($result.Notes)" -ForegroundColor DarkGray }
    Write-Host ""
    $position++
}

$winner = $ranking[0]
Write-Host "🏆 Gagnant : $($winner.Model)" -ForegroundColor Green
Write-Host ""
Write-Host "Pour installer définitivement le gagnant :" -ForegroundColor Cyan
Write-Host "  ollama pull $($winner.Model.ToLower() -replace ' .*','') # à adapter selon le label" -ForegroundColor White
Write-Host ""
