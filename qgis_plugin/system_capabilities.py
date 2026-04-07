# -*- coding: utf-8 -*-
"""
Détection des capacités du système pour Ollama et LLM
"""
import platform
import subprocess
import os
from typing import Dict, List, Optional

try:
    import psutil as _psutil
    _HAS_PSUTIL = True
except ImportError:
    _psutil = None  # type: ignore
    _HAS_PSUTIL = False


def _ram_total_gb_fallback() -> float:
    """Fallback RAM total via ctypes (Windows) ou /proc/meminfo (Linux/Mac)"""
    try:
        if platform.system() == "Windows":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            stat = MEMORYSTATUSEX()
            stat.dwLength = ctypes.sizeof(stat)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
            return (round(stat.ullTotalPhys / (1024**3), 1),
                    round(stat.ullAvailPhys / (1024**3), 1))
        elif os.path.exists("/proc/meminfo"):
            total, avail = 0, 0
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total = int(line.split()[1]) * 1024
                    elif line.startswith("MemAvailable:"):
                        avail = int(line.split()[1]) * 1024
            return (round(total / (1024**3), 1), round(avail / (1024**3), 1))
    except Exception:
        pass
    return (8.0, 4.0)


def _cpu_count_fallback():
    """Fallback CPU count via os.cpu_count"""
    try:
        logical = os.cpu_count() or 1
        return logical, max(1, logical // 2)
    except Exception:
        return 1, 1


class SystemCapabilities:
    """Détecte les capacités du système pour recommander des LLM"""
    
    def __init__(self):
        self.system_info = self._get_system_info()
    
    def _get_system_info(self) -> Dict:
        """Récupère les informations du système"""
        if _HAS_PSUTIL:
            ram_total = round(_psutil.virtual_memory().total / (1024**3), 1)
            ram_avail = round(_psutil.virtual_memory().available / (1024**3), 1)
            cpu_logical = _psutil.cpu_count(logical=True) or 1
            cpu_physical = _psutil.cpu_count(logical=False) or 1
        else:
            ram_total, ram_avail = _ram_total_gb_fallback()
            cpu_logical, cpu_physical = _cpu_count_fallback()

        info = {
            "platform": platform.system(),
            "platform_release": platform.release(),
            "platform_version": platform.version(),
            "architecture": platform.machine(),
            "processor": platform.processor(),
            "ram_total_gb": ram_total,
            "ram_available_gb": ram_avail,
            "cpu_count": cpu_logical,
            "cpu_physical_count": cpu_physical,
        }
        
        # Détection GPU
        info["gpu"] = self._detect_gpu()
        
        return info
    
    def _detect_gpu(self) -> Dict:
        """Détecte la présence et les capacités du GPU"""
        gpu_info = {
            "has_gpu": False,
            "gpu_name": None,
            "gpu_memory_gb": None,
            "supports_cuda": False,
            "supports_rocm": False,
        }
        
        try:
            # Tentative de détection NVIDIA avec nvidia-smi
            result = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                gpu_info["has_gpu"] = True
                gpu_info["supports_cuda"] = True
                lines = result.stdout.strip().split("\n")
                if lines:
                    parts = lines[0].split(", ")
                    gpu_info["gpu_name"] = parts[0].strip()
                    if len(parts) > 1:
                        mem_str = parts[1].strip()
                        # Extraire la valeur en GB
                        mem_gb = float(mem_str.split()[0])
                        gpu_info["gpu_memory_gb"] = mem_gb
        except (FileNotFoundError, subprocess.TimeoutExpired, Exception):
            pass
        
        return gpu_info
    
    def get_ollama_recommendation(self) -> Dict:
        """Recommande les modèles Ollama adaptés au système"""
        ram_gb = self.system_info["ram_total_gb"]
        has_gpu = self.system_info["gpu"]["has_gpu"]
        gpu_memory_gb = self.system_info["gpu"]["gpu_memory_gb"]
        
        recommendations = {
            "can_run_local": False,
            "recommended_models": [],
            "max_model_size_gb": 0,
            "reason": "",
        }
        
        # Calculer la mémoire disponible pour les modèles
        # On réserve 4GB pour le système + Ollama
        available_for_models = max(0, ram_gb - 4)
        
        if available_for_models < 4:
            recommendations["reason"] = "RAM insuffisante pour exécuter des LLM locaux"
            return recommendations
        
        recommendations["can_run_local"] = True
        recommendations["max_model_size_gb"] = available_for_models
        
        # Recommandations basées sur la RAM et le GPU
        if has_gpu and gpu_memory_gb:
            # Avec GPU
            if gpu_memory_gb >= 16:
                recommendations["recommended_models"] = [
                    {"name": "llama3.1:70b", "size_gb": 40, "description": "Modèle très puissant", "recommended": True},
                    {"name": "qwen2.5:32b", "size_gb": 20, "description": "Excellent équilibre performance/taille"},
                    {"name": "mistral:7b", "size_gb": 4.5, "description": "Rapide et performant"},
                    {"name": "phi3:14b", "size_gb": 9, "description": "Compact et performant"},
                ]
                recommendations["reason"] = "GPU puissant détecté, modèles de haute qualité recommandés"
            elif gpu_memory_gb >= 8:
                recommendations["recommended_models"] = [
                    {"name": "qwen2.5:14b", "size_gb": 9, "description": "Excellent équilibre", "recommended": True},
                    {"name": "mistral:7b", "size_gb": 4.5, "description": "Rapide et performant"},
                    {"name": "phi3:14b", "size_gb": 9, "description": "Compact et performant"},
                    {"name": "gemma2:9b", "size_gb": 5.5, "description": "Google Gemini"},
                ]
                recommendations["reason"] = "GPU moyen détecté, modèles de qualité moyenne recommandés"
            else:
                recommendations["recommended_models"] = [
                    {"name": "phi3:4b", "size_gb": 2.5, "description": "Ultra compact", "recommended": True},
                    {"name": "gemma2:4b", "size_gb": 2.5, "description": "Google compact"},
                    {"name": "mistral:7b", "size_gb": 4.5, "description": "Si RAM suffisante"},
                ]
                recommendations["reason"] = "GPU avec mémoire limitée, modèles compacts recommandés"
        else:
            # Sans GPU (CPU only)
            if available_for_models >= 16:
                recommendations["recommended_models"] = [
                    {"name": "qwen2.5:7b", "size_gb": 4.5, "description": "CPU optimisé", "recommended": True},
                    {"name": "mistral:7b", "size_gb": 4.5, "description": "Bon sur CPU"},
                    {"name": "phi3:4b", "size_gb": 2.5, "description": "Ultra rapide"},
                ]
                recommendations["reason"] = "CPU uniquement, modèles optimisés CPU recommandés"
            elif available_for_models >= 8:
                recommendations["recommended_models"] = [
                    {"name": "phi3:4b", "size_gb": 2.5, "description": "Ultra compact", "recommended": True},
                    {"name": "gemma2:4b", "size_gb": 2.5, "description": "Google compact"},
                ]
                recommendations["reason"] = "RAM limitée, modèles compacts recommandés"
            else:
                recommendations["recommended_models"] = [
                    {"name": "phi3:mini", "size_gb": 2, "description": "Le plus compact", "recommended": True},
                ]
                recommendations["reason"] = "RAM minimale, seul modèle compact possible"
        
        return recommendations
    
    def get_all_available_models(self) -> List[Dict]:
        """Retourne la liste de tous les modèles Ollama disponibles"""
        models = [
            # Modèles très puissants (16GB+ GPU)
            {"name": "llama3.1:70b", "size_gb": 40, "category": "high", "description": "Meilleur modèle généraliste", "requires_gpu": True, "min_ram_gb": 32},
            {"name": "qwen2.5:32b", "size_gb": 20, "category": "high", "description": "Excellent pour le code", "requires_gpu": True, "min_ram_gb": 24},
            
            # Modèles puissants (8GB+ GPU)
            {"name": "llama3.1:8b", "size_gb": 4.5, "category": "medium", "description": "Excellent équilibre", "requires_gpu": False, "min_ram_gb": 8},
            {"name": "qwen2.5:14b", "size_gb": 9, "category": "medium", "description": "Très performant", "requires_gpu": True, "min_ram_gb": 12},
            {"name": "mistral:7b", "size_gb": 4.5, "category": "medium", "description": "Rapide et performant", "requires_gpu": False, "min_ram_gb": 8},
            {"name": "phi3:14b", "size_gb": 9, "category": "medium", "description": "Compact et performant", "requires_gpu": True, "min_ram_gb": 12},
            {"name": "gemma2:9b", "size_gb": 5.5, "category": "medium", "description": "Google Gemini", "requires_gpu": False, "min_ram_gb": 8},
            
            # Modèles compacts (4-8GB RAM)
            {"name": "qwen2.5:7b", "size_gb": 4.5, "category": "low", "description": "CPU optimisé", "requires_gpu": False, "min_ram_gb": 6},
            {"name": "phi3:4b", "size_gb": 2.5, "category": "low", "description": "Ultra compact", "requires_gpu": False, "min_ram_gb": 4},
            {"name": "gemma2:4b", "size_gb": 2.5, "category": "low", "description": "Google compact", "requires_gpu": False, "min_ram_gb": 4},
            {"name": "llama3.1:3b", "size_gb": 2, "category": "low", "description": "Compact", "requires_gpu": False, "min_ram_gb": 4},
            
            # Modèles ultra compacts (2-4GB RAM)
            {"name": "phi3:mini", "size_gb": 2, "category": "minimal", "description": "Le plus compact", "requires_gpu": False, "min_ram_gb": 3},
            {"name": "tinyllama", "size_gb": 1.1, "category": "minimal", "description": "Ultra léger", "requires_gpu": False, "min_ram_gb": 2},
            {"name": "gemma:2b", "size_gb": 1.5, "category": "minimal", "description": "Google ultra léger", "requires_gpu": False, "min_ram_gb": 2},
        ]
        
        # Filtrer selon les capacités du système
        available_models = []
        for model in models:
            if self.system_info["ram_total_gb"] >= model["min_ram_gb"]:
                if not model["requires_gpu"] or self.system_info["gpu"]["has_gpu"]:
                    available_models.append(model)
        
        return available_models
    
    def to_dict(self) -> Dict:
        """Retourne toutes les informations sous forme de dictionnaire"""
        return {
            "system_info": self.system_info,
            "recommendations": self.get_ollama_recommendation(),
            "available_models": self.get_all_available_models(),
        }


# Instance globale
system_capabilities = SystemCapabilities()
