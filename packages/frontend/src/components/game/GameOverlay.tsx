import React, { useState } from 'react';
import { Minimap } from './Minimap';
import { AgentInspector } from './AgentInspector';

export interface GameOverlayProps {
  worldWidth: number;
  worldHeight: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  selectedAgent?: {
    id: string;
    name: string;
    state: string;
    metrics: Record<string, number>;
    events: Array<{ timestamp: number; message: string }>;
  };
  onMinimapClick?: (x: number, y: number) => void;
  onAgentAction?: (action: string) => void;
}

/**
 * GameOverlay - React overlay on top of Phaser canvas
 *
 * Features:
 * - HUD with minimap
 * - Agent inspector panel
 * - Menu system
 * - Dialog system
 */
export function GameOverlay({
  worldWidth,
  worldHeight,
  cameraX,
  cameraY,
  cameraZoom,
  selectedAgent,
  onMinimapClick,
  onAgentAction,
}: GameOverlayProps) {
  const [showMinimap, setShowMinimap] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="game-overlay" style={styles.overlay}>
      {/* Top HUD */}
      <div style={styles.topHud}>
        <div style={styles.hudLeft}>
          <h1 style={styles.title}>AI Agent Village Monitor</h1>
        </div>
        <div style={styles.hudRight}>
          <button style={styles.hudButton} onClick={() => setShowMenu(!showMenu)}>
            Menu
          </button>
        </div>
      </div>

      {/* Minimap */}
      {showMinimap && (
        <div style={styles.minimapContainer}>
          <div style={styles.panelHeader}>
            <span>Map</span>
            <button style={styles.closeButton} onClick={() => setShowMinimap(false)}>
              ×
            </button>
          </div>
          <Minimap
            worldWidth={worldWidth}
            worldHeight={worldHeight}
            cameraX={cameraX}
            cameraY={cameraY}
            cameraZoom={cameraZoom}
            onClick={onMinimapClick}
          />
        </div>
      )}

      {/* Agent Inspector */}
      {showInspector && selectedAgent && (
        <div style={styles.inspectorContainer}>
          <div style={styles.panelHeader}>
            <span>Agent Inspector</span>
            <button style={styles.closeButton} onClick={() => setShowInspector(false)}>
              ×
            </button>
          </div>
          <AgentInspector agent={selectedAgent} onAction={onAgentAction} />
        </div>
      )}

      {/* Menu */}
      {showMenu && (
        <div style={styles.menuContainer}>
          <div style={styles.menu}>
            <h2 style={styles.menuTitle}>Menu</h2>
            <button style={styles.menuButton}>Settings</button>
            <button style={styles.menuButton}>Help</button>
            <button style={styles.menuButton} onClick={() => setShowMinimap(true)}>
              Show Minimap
            </button>
            <button style={styles.menuButton} onClick={() => setShowMenu(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toggle buttons for hidden panels */}
      {!showMinimap && (
        <button style={{ ...styles.toggleButton, bottom: 20, right: 20 }} onClick={() => setShowMinimap(true)}>
          Show Map
        </button>
      )}

      {!showInspector && selectedAgent && (
        <button style={{ ...styles.toggleButton, bottom: 60, right: 20 }} onClick={() => setShowInspector(true)}>
          Show Inspector
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 100,
  },
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 20px',
    pointerEvents: 'auto',
  },
  hudLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  hudRight: {
    display: 'flex',
    gap: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: 'monospace',
    margin: 0,
  },
  hudButton: {
    padding: '8px 16px',
    background: 'rgba(96, 165, 250, 0.8)',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 14,
  },
  minimapContainer: {
    position: 'absolute',
    top: 80,
    right: 20,
    background: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 8,
    padding: 10,
    pointerEvents: 'auto',
    border: '2px solid rgba(96, 165, 250, 0.5)',
  },
  inspectorContainer: {
    position: 'absolute',
    top: 80,
    left: 20,
    background: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 8,
    padding: 10,
    pointerEvents: 'auto',
    border: '2px solid rgba(96, 165, 250, 0.5)',
    maxWidth: 350,
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: 'bold',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#ffffff',
    fontSize: 24,
    cursor: 'pointer',
    padding: 0,
    width: 24,
    height: 24,
    lineHeight: '24px',
  },
  menuContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'auto',
  },
  menu: {
    background: 'rgba(31, 41, 55, 0.95)',
    borderRadius: 8,
    padding: 30,
    minWidth: 300,
    border: '2px solid rgba(96, 165, 250, 0.5)',
  },
  menuTitle: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  menuButton: {
    width: '100%',
    padding: '12px 20px',
    background: 'rgba(96, 165, 250, 0.8)',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 16,
    marginBottom: 10,
  },
  toggleButton: {
    position: 'absolute',
    padding: '8px 16px',
    background: 'rgba(96, 165, 250, 0.8)',
    border: 'none',
    borderRadius: 4,
    color: '#ffffff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 14,
    pointerEvents: 'auto',
  },
};
