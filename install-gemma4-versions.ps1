# Script PowerShell pour installer et tester les versions de Gemma 4
# Exécutez ce script dans PowerShell en tant qu'administrateur

Write-Host "=== Installation des versions de Gemma 4 pour test ===" -ForegroundColor Green
Write-Host ""

# Vérifier si Ollama est installé
try {
    $ollamaCheck = ollama --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Ollama n'est pas installé ou n'est pas dans le PATH" -ForegroundColor Red
        Write-Host "Veuillez installer Ollama d'abord : https://ollama.com/download" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Ollama détecté : $ollamaCheck" -ForegroundColor Green
} catch {
    Write-Host "❌ Ollama n'est pas installé" -ForegroundColor Red
    exit 1
}

# Liste des versions à tester
$versions = @(
    @{ Name = "gemma4:4b"; Description = "Version légère (4B params, ~2.5GB)"; RAM = "6GB+" }
    @{ Name = "gemma4:9b"; Description = "Version standard (9B params, ~5.5GB)"; RAM = "12GB+" }
    @{ Name = "gemma4:12b"; Description = "Version avancée (12B params, ~7.5GB)"; RAM = "16GB+" }
    @{ Name = "gemma4:27b"; Description = "Version maximale (27B params, ~17GB)"; RAM = "32GB+" }
)

Write-Host ""
Write-Host "📋 Versions disponibles :" -ForegroundColor Cyan
foreach ($ver in $versions) {
    Write-Host "  • $($ver.Name) : $($ver.Description) - RAM recommandée: $($ver.RAM)" -ForegroundColor White
}

Write-Host ""
Write-Host "⚠️  AVERTISSEMENT :" -ForegroundColor Yellow
Write-Host "Ces modèles nécessitent beaucoup d'espace disque (~32GB au total)" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Voulez-vous continuer ? (oui/non)"
if ($confirmation -ne "oui") {
    Write-Host "Installation annulée." -ForegroundColor Yellow
    exit 0
}

# Fonction pour installer un modèle
function Install-Model {
    param($ModelName)
    
    Write-Host ""
    Write-Host "📥 Installation de $ModelName..." -ForegroundColor Cyan
    Write-Host "⏳ Cela peut prendre plusieurs minutes selon votre connexion..." -ForegroundColor Gray
    
    try {
        $startTime = Get-Date
        ollama pull $ModelName 2>&1 | ForEach-Object {
            Write-Host "  $_" -ForegroundColor Gray
        }
        $endTime = Get-Date
        $duration = ($endTime - $startTime).ToString("mm\:ss")
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $ModelName installé avec succès en $duration" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ Échec de l'installation de $ModelName" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Erreur lors de l'installation : $_" -ForegroundColor Red
        return $false
    }
}

# Installer chaque version
$installed = @()
foreach ($ver in $versions) {
    $result = Install-Model -ModelName $ver.Name
    if ($result) {
        $installed += $ver.Name
    }
    Write-Host ""
}

# Résumé
Write-Host ""
Write-Host "=== RÉSUMÉ ===" -ForegroundColor Green
Write-Host "Versions installées :" -ForegroundColor Cyan
foreach ($model in $installed) {
    Write-Host "  ✅ $model" -ForegroundColor Green
}

Write-Host ""
Write-Host "🧪 Guide de test :" -ForegroundColor Cyan
Write-Host "1. Ouvrez le plugin QGISAI+" -ForegroundColor White
Write-Host "2. Allez dans Settings → Modèles Locaux" -ForegroundColor White
Write-Host "3. Testez chaque version avec des prompts variés :" -ForegroundColor White
Write-Host "   • Questions sur QGIS" -ForegroundColor Gray
Write-Host "   • Génération de code PyQGIS" -ForegroundColor Gray
Write-Host "   • Analyse de données" -ForegroundColor Gray
Write-Host "   • Instructions complexes" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Notez la qualité et la vitesse de chaque version" -ForegroundColor White
Write-Host ""

# Vérifier l'espace disque
$disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 2)
Write-Host "💾 Espace disque disponible : $freeSpaceGB GB" -ForegroundColor Cyan

if ($freeSpaceGB -lt 50) {
    Write-Host "⚠️  Espace disque faible !" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pour supprimer les modèles après test, utilisez :" -ForegroundColor Gray
Write-Host "  ollama rm <nom-du-modele>" -ForegroundColor Gray
Write-Host ""
Write-Host "Exemple :" -ForegroundColor Gray
Write-Host "  ollama rm gemma4:27b  # Supprime la version 27B" -ForegroundColor Gray
Write-Host ""
