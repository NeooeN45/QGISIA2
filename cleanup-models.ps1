# Script PowerShell pour nettoyer les modèles après test
# Garde uniquement le modèle gagnant et supprime les gros modèles inutiles

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("gemma2:2b", "gemma2:4b", "gemma2:9b", "gemma2:27b")]
    [string]$KeepModel
)

Write-Host "=== Nettoyage des modèles Ollama ===" -ForegroundColor Green
Write-Host ""
Write-Host "🏆 Modèle à conserver : $KeepModel" -ForegroundColor Cyan
Write-Host ""

# Vérifier Ollama
try {
    $ollamaList = ollama list 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ollama n'est pas accessible" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Ollama n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
    exit 1
}

# Liste des modèles à supprimer (tous sauf le gagnant)
$gemmaVersions = @("gemma2:2b", "gemma2:4b", "gemma2:9b", "gemma2:27b")
$modelsToRemove = $gemmaVersions | Where-Object { $_ -ne $KeepModel }

# Autres gros modèles à supprimer
$bigModelsToRemove = @(
    "mixtral:8x7b"
    "mixtral:8x22b"
    "llama3.1:70b"
    "llama3.1:405b"
    "qwen2.5:72b"
    "qwen2.5:110b"
    "deepseek-coder:33b"
    "deepseek-coder-v2:236b"
    "command-r:104b"
    "command-r-plus"
)

$allModelsToRemove = $modelsToRemove + $bigModelsToRemove

Write-Host "🗑️  Modèles à supprimer :" -ForegroundColor Yellow
foreach ($model in $allModelsToRemove) {
    Write-Host "  • $model" -ForegroundColor Gray
}

Write-Host ""
$confirmation = Read-Host "⚠️  Cette action est irréversible. Continuer ? (oui/non)"
if ($confirmation -ne "oui") {
    Write-Host "Opération annulée." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🚀 Suppression en cours..." -ForegroundColor Cyan
Write-Host ""

$removed = @()
$failed = @()

foreach ($model in $allModelsToRemove) {
    # Vérifier si le modèle est installé
    $isInstalled = ollama list | Select-String $model
    
    if ($isInstalled) {
        Write-Host "🗑️  Suppression de $model..." -ForegroundColor Gray -NoNewline
        try {
            ollama rm $model 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-Host " ✅" -ForegroundColor Green
                $removed += $model
            } else {
                Write-Host " ❌" -ForegroundColor Red
                $failed += $model
            }
        } catch {
            Write-Host " ❌ (Erreur: $_)" -ForegroundColor Red
            $failed += $model
        }
    } else {
        Write-Host "⏭️  $model n'est pas installé" -ForegroundColor DarkGray
    }
}

# Configurer le modèle gagnant par défaut dans le plugin
Write-Host ""
Write-Host "⚙️  Configuration du modèle par défaut..." -ForegroundColor Cyan
Write-Host ""

# Créer/mettre à jour le fichier de config local
$configContent = @"
# Configuration locale pour QGISAI+
# Généré automatiquement après test des versions Gemma 4

RECOMMENDED_MODEL=$KeepModel
MODEL_TESTED=true
TEST_DATE=$(Get-Date -Format "yyyy-MM-dd")

# Paramètres optimaux pour $KeepModel
TEMPERATURE=0.7
TOP_P=0.95
MAX_TOKENS=8192
NUM_GPU=-1
"@

$configPath = Join-Path $PSScriptRoot ".qgisai-config"
$configContent | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "✅ Configuration sauvegardée dans : $configPath" -ForegroundColor Green

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
Write-Host "🏆 Modèle par défaut : $KeepModel" -ForegroundColor Cyan
Write-Host ""

# Calculer l'espace libéré
Write-Host "💾 Espace disque :" -ForegroundColor Cyan
try {
    $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    $totalSpaceGB = [math]::Round($disk.Size / 1GB, 2)
    $usedSpaceGB = $totalSpaceGB - $freeSpaceGB
    $percentFree = [math]::Round(($freeSpaceGB / $totalSpaceGB) * 100, 1)
    
    Write-Host "  Libre : $freeSpaceGB GB ($percentFree%)" -ForegroundColor $(if($percentFree -lt 20){"Red"}elseif($percentFree -lt 50){"Yellow"}else{"Green"})
    Write-Host "  Total : $totalSpaceGB GB" -ForegroundColor Gray
} catch {
    Write-Host "  Impossible de récupérer les infos disque" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Prochaines étapes :" -ForegroundColor Green
Write-Host "1. Ouvrez QGISAI+ dans QGIS" -ForegroundColor White
Write-Host "2. Allez dans Settings → Modèles Locaux" -ForegroundColor White
Write-Host "3. Sélectionnez : $KeepModel" -ForegroundColor White
Write-Host "4. Testez le plugin !" -ForegroundColor White
Write-Host ""
Write-Host "💡 Astuce : Vous pouvez réinstaller les autres versions avec :" -ForegroundColor Gray
Write-Host "   ollama pull <nom-du-modele>" -ForegroundColor Gray
Write-Host ""
