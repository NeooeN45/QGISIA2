# Script de test "One-by-One" pour modèles HuggingFace
# Installe → Teste → Note → Supprime → Passe au suivant

param(
    [string]$ApiKey = "",
    [string]$Provider = "huggingface"  # huggingface ou ollama
)

# Modèles à tester avec leurs prompts de test
$modelsToTest = @(
    @{
        Name = "google/gemma-4-4b-it"
        Label = "Gemma 4 4B"
        SizeGB = 8
        TestPrompts = @(
            "Explique comment créer une couche vectorielle dans QGIS en 3 étapes",
            "Écris un script Python pour bufferiser une couche vectorielle dans QGIS",
            "Quelle est la différence entre un système de coordonnées projeté et géographique ?"
        )
    },
    @{
        Name = "google/gemma-4-9b-it"
        Label = "Gemma 4 9B"
        SizeGB = 18
        TestPrompts = @(
            "Explique comment créer une couche vectorielle dans QGIS en 3 étapes",
            "Écris un script Python pour bufferiser une couche vectorielle dans QGIS",
            "Quelle est la différence entre un système de coordonnées projeté et géographique ?"
        )
    },
    @{
        Name = "google/gemma-4-12b-it"
        Label = "Gemma 4 12B"
        SizeGB = 24
        TestPrompts = @(
            "Explique comment créer une couche vectorielle dans QGIS en 3 étapes",
            "Écris un script Python pour bufferiser une couche vectorielle dans QGIS",
            "Quelle est la différence entre un système de coordonnées projeté et géographique ?"
        )
    },
    @{
        Name = "google/gemma-4-27b-it"
        Label = "Gemma 4 27B"
        SizeGB = 54
        TestPrompts = @(
            "Explique comment créer une couche vectorielle dans QGIS en 3 étapes",
            "Écris un script Python pour bufferiser une couche vectorielle dans QGIS",
            "Quelle est la différence entre un système de coordonnées projeté et géographique ?"
        )
    }
)

# Fonction pour tester via API HuggingFace
function Test-HuggingFaceModel {
    param($ModelId, $Prompt, $ApiKey)
    
    $body = @{
        inputs = $Prompt
        parameters = @{
            temperature = 0.7
            max_new_tokens = 1024
            return_full_text = $false
        }
    } | ConvertTo-Json
    
    $startTime = Get-Date
    try {
        $response = Invoke-RestMethod -Uri "https://api-inference.huggingface.co/models/$ModelId" -Method Post -Headers @{ "Authorization" = "Bearer $ApiKey"; "Content-Type" = "application/json" } -Body $body -TimeoutSec 120
        $endTime = Get-Date
        $duration = ($endTime - $startTime).TotalSeconds
        
        return @{
            Success = $true
            Response = $response[0].generated_text
            Duration = $duration
            TokensPerSecond = ($response[0].generated_text.Length / $duration)
        }
    } catch {
        return @{
            Success = $false
            Error = $_.Exception.Message
            Duration = 0
        }
    }
}

# Fonction pour noter un modèle
function Score-Model {
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

# Fonction pour sauvegarder les résultats
function Save-Results {
    param($Results)
    
    $resultsPath = Join-Path $PSScriptRoot "hf-model-test-results.json"
    $Results | ConvertTo-Json -Depth 4 | Out-File -FilePath $resultsPath -Encoding UTF8
    Write-Host "✅ Résultats sauvegardés dans : $resultsPath" -ForegroundColor Green
}

# === MAIN ===

Write-Host "=== Système de Test Modèles HuggingFace ===" -ForegroundColor Green
Write-Host "Mode: Test One-by-One (Installe → Teste → Note → Supprime)" -ForegroundColor Gray
Write-Host ""

if ([string]::IsNullOrEmpty($ApiKey)) {
    Write-Host "❌ Clé API HuggingFace requise" -ForegroundColor Red
    Write-Host "Obtenez une clé gratuite sur https://huggingface.co/settings/tokens" -ForegroundColor Yellow
    $ApiKey = Read-Host "Entrez votre clé API HuggingFace"
}

Write-Host ""
Write-Host "📋 Modèles à tester :" -ForegroundColor Cyan
foreach ($model in $modelsToTest) {
    Write-Host "  • $($model.Label) (~$($model.SizeGB) GB)" -ForegroundColor White
}

Write-Host ""
$confirmation = Read-Host "⚠️  Cette opération va télécharger/supprimer les modèles un par un. Continuer ? (oui/non)"
if ($confirmation -ne "oui") {
    Write-Host "Test annulé." -ForegroundColor Yellow
    exit 0
}

$allResults = @()

foreach ($model in $modelsToTest) {
    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host "  TEST : $($model.Label)" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host ""
    
    # 1. Vérifier l'espace disque
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    
    if ($freeSpaceGB -lt ($model.SizeGB + 2)) {
        Write-Host "❌ Espace disque insuffisant ($freeSpaceGB GB libre, besoin de $($model.SizeGB + 2) GB)" -ForegroundColor Red
        Write-Host "⏭️  Passage au modèle suivant..." -ForegroundColor Yellow
        continue
    }
    
    # 2. Tester via API (pas besoin de télécharger pour HuggingFace)
    Write-Host "🧪 Test via API HuggingFace..." -ForegroundColor Cyan
    $responses = @()
    $durations = @()
    
    foreach ($prompt in $model.TestPrompts) {
        Write-Host "  Prompt: $prompt" -ForegroundColor Gray
        $result = Test-HuggingFaceModel -ModelId $model.Name -Prompt $prompt -ApiKey $ApiKey
        
        if ($result.Success) {
            Write-Host "  ✅ Réponse en $([math]::Round($result.Duration, 2))s" -ForegroundColor Green
            $responses += $result.Response
            $durations += $result.Duration
            
            # Afficher un extrait de la réponse
            $preview = if ($result.Response.Length -gt 100) { $result.Response.Substring(0, 100) + "..." } else { $result.Response }
            Write-Host "     $preview" -ForegroundColor DarkGray
        } else {
            Write-Host "  ❌ Erreur: $($result.Error)" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    # 3. Noter le modèle
    if ($responses.Count -gt 0) {
        $scoreResult = Score-Model -Label $model.Label -Responses $responses -Durations $durations
        $allResults += $scoreResult
        
        Write-Host ""
        Write-Host "📊 Score pour $($model.Label) : $($scoreResult.TotalScore)/100" -ForegroundColor Cyan
    } else {
        Write-Host "⚠️  Aucune réponse valide pour $($model.Label)" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "✅ $($model.Label) testé et noté !" -ForegroundColor Green
    Write-Host "   (Le modèle n'est pas stocké localement - test via API)" -ForegroundColor Gray
    Write-Host ""
    
    # Pause avant le suivant
    Read-Host "Appuyez sur Entrée pour passer au modèle suivant..."
}

# 4. Sauvegarder tous les résultats
Save-Results -Results $allResults

# 5. Afficher le classement
Write-Host ""
Write-Host "=== CLASSEMENT FINAL ===" -ForegroundColor Green
Write-Host ""

$ranking = $allResults | Sort-Object -Property TotalScore -Descending
$position = 1
foreach ($result in $ranking) {
    $color = if ($position -eq 1) { "Green" } elseif ($position -eq 2) { "Yellow" } else { "Gray" }
    Write-Host "$position. $($result.Model) - Score: $($result.TotalScore)/100" -ForegroundColor $color
    Write-Host "   Qualité: $($result.Quality)/10 | Vitesse: $($result.Speed)/10 | Pertinence: $($result.Relevance)/10" -ForegroundColor Gray
    if ($result.Notes) {
        Write-Host "   Notes: $($result.Notes)" -ForegroundColor DarkGray
    }
    Write-Host ""
    $position++
}

Write-Host ""
Write-Host "🏆 Gagnant : $($ranking[0].Model)" -ForegroundColor Green
Write-Host ""
Write-Host "Prochaines étapes :" -ForegroundColor Cyan
Write-Host "1. Utilisez cleanup-hf-models.ps1 pour installer le gagnant en local" -ForegroundColor White
Write-Host "2. Configurez le modèle dans Settings du plugin" -ForegroundColor White
Write-Host ""
