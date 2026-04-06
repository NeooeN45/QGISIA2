# -*- coding: utf-8 -*-
"""
Interface utilisateur améliorée pour le plugin GeoAI Assistant
"""
from qgis.PyQt.QtCore import Qt, QUrl, pyqtSignal, pyqtSlot, QTimer
from qgis.PyQt.QtGui import QIcon, QMovie
from qgis.PyQt.QtWidgets import (
    QDockWidget,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QLabel,
    QFrame,
    QScrollArea,
    QGridLayout,
    QProgressBar,
)
from qgis.core import Qgis

from .config import PLUGIN_CONFIG


class QuickActionButton(QPushButton):
    """Bouton d'action rapide avec icône et tooltip"""
    
    def __init__(self, action_config, parent=None):
        super().__init__(parent)
        self.action_id = action_config["id"]
        self.setText(action_config["label"])
        self.setToolTip(action_config["tooltip"])
        self.setMinimumHeight(40)
        self.setStyleSheet("""
            QPushButton {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(8, 145, 178, 0.2), stop:1 rgba(8, 145, 178, 0.1));
                border: 1px solid rgba(8, 145, 178, 0.3);
                border-radius: 8px;
                color: #e3e3e3;
                padding: 8px 12px;
                font-size: 12px;
                font-weight: 500;
            }
            QPushButton:hover {
                background: qlineargradient(x1:0, y1:0, x2:0, y2:1,
                    stop:0 rgba(8, 145, 178, 0.4), stop:1 rgba(8, 145, 178, 0.2));
                border-color: rgba(8, 145, 178, 0.5);
            }
            QPushButton:pressed {
                background: rgba(8, 145, 178, 0.3);
            }
        """)


class StatusIndicator(QLabel):
    """Indicateur de status avec animation"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(12, 12)
        self._status = "disconnected"
        self._update_style()

    def set_status(self, status):
        """Définit le status: connected, disconnected, loading, error"""
        self._status = status
        self._update_style()

    def _update_style(self):
        """Met à jour le style selon le status"""
        colors = {
            "connected": "#10b981",  # green
            "disconnected": "#6b7280",  # gray
            "loading": "#f59e0b",  # amber
            "error": "#ef4444",  # red
        }
        color = colors.get(self._status, "#6b7280")
        self.setStyleSheet(f"""
            QLabel {{
                background: {color};
                border-radius: 6px;
            }}
        """)


class LoadingOverlay(QWidget):
    """Overlay de chargement semi-transparent"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        self._animation_timer = None
        self._dot_index = 0

    def _setup_ui(self):
        """Configure l'interface de l'overlay"""
        self.setWindowFlags(Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setAttribute(Qt.WA_TransparentForMouseEvents, False)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        # Container semi-transparent
        container = QWidget()
        container.setStyleSheet("""
            QWidget {
                background: rgba(19, 19, 20, 0.95);
                border-radius: 8px;
            }
        """)
        container_layout = QVBoxLayout(container)
        container_layout.setContentsMargins(24, 24, 24, 24)
        container_layout.setSpacing(16)

        # Message de chargement
        self.message_label = QLabel("Chargement...")
        self.message_label.setStyleSheet("""
            QLabel {
                color: #e3e3e3;
                font-size: 14px;
                font-weight: 500;
            }
        """)
        self.message_label.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(self.message_label)

        # Indicateur de progression animé
        self.progress_label = QLabel("●●●")
        self.progress_label.setStyleSheet("""
            QLabel {
                color: #10b981;
                font-size: 20px;
                letter-spacing: 4px;
            }
        """)
        self.progress_label.setAlignment(Qt.AlignCenter)
        container_layout.addWidget(self.progress_label)

        layout.addWidget(container, 0, Qt.AlignCenter)

    def set_message(self, message):
        """Définit le message de chargement"""
        self.message_label.setText(message)

    def _animate_dots(self):
        """Anime les points de progression"""
        dots = ["●", "●●", "●●●"]
        self._dot_index = (self._dot_index + 1) % len(dots)
        self.progress_label.setText(dots[self._dot_index])

    def start_animation(self):
        """Démarre l'animation"""
        if self._animation_timer is None:
            self._animation_timer = QTimer()
            self._animation_timer.timeout.connect(self._animate_dots)
            self._animation_timer.start(500)

    def stop_animation(self):
        """Arrête l'animation"""
        if self._animation_timer is not None:
            self._animation_timer.stop()
            self._animation_timer = None
        self.progress_label.setText("●●●")


class EnhancedDockWidget(QDockWidget):
    """Dock widget amélioré avec interface utilisateur moderne"""
    
    # Signaux
    action_triggered = pyqtSignal(str)  # Quand une action rapide est déclenchée
    settings_requested = pyqtSignal()  # Quand les paramètres sont demandés
    
    def __init__(self, iface, parent=None):
        super().__init__(PLUGIN_CONFIG["dock_title"], parent)
        self.iface = iface
        self.setObjectName("geoaiEnhancedDock")

        # Overlay de chargement
        self.loading_overlay = None

        # Configuration
        self.setAllowedAreas(
            Qt.LeftDockWidgetArea | Qt.RightDockWidgetArea
        )

        # Créer le widget principal
        self._create_ui()

        # Appliquer le style
        self._apply_style()
    
    def _create_ui(self):
        """Crée l'interface utilisateur"""
        # Widget conteneur
        container = QWidget()
        container.setObjectName("geoaiContainer")
        layout = QVBoxLayout(container)
        layout.setContentsMargins(12, 12, 12, 12)
        layout.setSpacing(12)
        
        # Header avec status
        header = self._create_header()
        layout.addWidget(header)
        
        # Séparateur
        separator = QFrame()
        separator.setFrameShape(QFrame.HLine)
        separator.setFrameShadow(QFrame.Sunken)
        separator.setStyleSheet("background: rgba(255, 255, 255, 0.1);")
        layout.addWidget(separator)
        
        # Actions rapides
        if PLUGIN_CONFIG["show_quick_actions"]:
            quick_actions = self._create_quick_actions()
            layout.addWidget(quick_actions)
        
        # Zone de contenu (WebView sera ajoutée ici)
        self.content_area = QWidget()
        self.content_layout = QVBoxLayout(self.content_area)
        self.content_layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.content_area, 1)
        
        # Footer avec boutons
        footer = self._create_footer()
        layout.addWidget(footer)
        
        # Définir le widget du dock
        self.setWidget(container)
    
    def _create_header(self):
        """Crée le header avec titre et status"""
        header = QWidget()
        header_layout = QHBoxLayout(header)
        header_layout.setContentsMargins(0, 0, 0, 0)
        
        # Titre
        title = QLabel(PLUGIN_CONFIG["dock_title"])
        title.setStyleSheet("""
            QLabel {
                color: #e3e3e3;
                font-size: 16px;
                font-weight: 600;
            }
        """)
        header_layout.addWidget(title, 1)
        
        # Indicateur de status
        self.status_indicator = StatusIndicator()
        self.status_indicator.set_status("disconnected")
        header_layout.addWidget(self.status_indicator)
        
        return header
    
    def _create_quick_actions(self):
        """Crée les boutons d'action rapide"""
        container = QWidget()
        container.setObjectName("quickActionsContainer")
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        
        # Titre
        title = QLabel("Actions rapides")
        title.setStyleSheet("""
            QLabel {
                color: #9ca3af;
                font-size: 11px;
                font-weight: 500;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
        """)
        layout.addWidget(title)
        
        # Grille de boutons
        grid = QGridLayout()
        grid.setSpacing(8)
        
        actions = PLUGIN_CONFIG["quick_actions"]
        for i, action_config in enumerate(actions):
            button = QuickActionButton(action_config)
            button.clicked.connect(lambda checked, aid=action_config["id"]: self.action_triggered.emit(aid))
            row = i // 2
            col = i % 2
            grid.addWidget(button, row, col)
        
        layout.addLayout(grid)
        
        return container
    
    def _create_footer(self):
        """Crée le footer avec boutons d'action"""
        footer = QWidget()
        footer_layout = QHBoxLayout(footer)
        footer_layout.setContentsMargins(0, 0, 0, 0)
        footer_layout.setSpacing(8)
        
        # Bouton de paramètres
        if PLUGIN_CONFIG["show_settings_button"]:
            settings_btn = QPushButton("⚙️")
            settings_btn.setToolTip("Paramètres")
            settings_btn.setFixedSize(32, 32)
            settings_btn.setStyleSheet("""
                QPushButton {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 6px;
                    color: #9ca3af;
                    font-size: 14px;
                }
                QPushButton:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #e3e3e3;
                }
            """)
            settings_btn.clicked.connect(self.settings_requested.emit)
            footer_layout.addWidget(settings_btn)
        
        footer_layout.addStretch()
        
        # Label de version
        version_label = QLabel(f"v{PLUGIN_CONFIG['version']}")
        version_label.setStyleSheet("""
            QLabel {
                color: #6b7280;
                font-size: 10px;
            }
        """)
        footer_layout.addWidget(version_label)
        
        return footer
    
    def _apply_style(self):
        """Applique le style global"""
        self.setStyleSheet("""
            QDockWidget#geoaiEnhancedDock {
                background: #131314;
                border: none;
            }
            QWidget#geoaiContainer {
                background: #131314;
            }
        """)
    
    def set_web_view(self, web_view):
        """Définit la WebView dans la zone de contenu"""
        # Nettoyer le layout existant
        while self.content_layout.count():
            item = self.content_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        # Ajouter la WebView
        self.content_layout.addWidget(web_view)
    
    def set_connection_status(self, connected):
        """Met à jour l'indicateur de connexion"""
        self.status_indicator.set_status("connected" if connected else "disconnected")

    def show_loading(self, message="Chargement..."):
        """Affiche un indicateur de chargement"""
        if self.loading_overlay is None:
            self.loading_overlay = LoadingOverlay(self)
            self.loading_overlay.setGeometry(self.rect())

        self.loading_overlay.set_message(message)
        self.loading_overlay.start_animation()
        self.loading_overlay.raise_()
        self.loading_overlay.show()

    def hide_loading(self):
        """Masque l'indicateur de chargement"""
        if self.loading_overlay is not None:
            self.loading_overlay.stop_animation()
            self.loading_overlay.hide()
