import React, { useRef, useEffect, useState } from 'react';

export interface RoomInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'python' | 'javascript' | 'typescript' | 'go' | 'rust' | 'java' | 'other';
  name: string;
}

export interface AgentMarker {
  id: string;
  x: number;
  y: number;
  state: 'active' | 'idle' | 'thinking' | 'offline';
}

export interface MinimapProps {
  worldWidth: number;
  worldHeight: number;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
  rooms?: RoomInfo[];
  agents?: AgentMarker[];
  width?: number;
  height?: number;
  showZoomControls?: boolean;
  onClick?: (x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
}

/**
 * Minimap - Enhanced world view with real-time rendering
 *
 * Features:
 * - Real-time room rendering (colored by type)
 * - Agent position markers (colored by state)
 * - Camera viewport indicator
 * - Click to pan functionality
 * - Zoom controls
 * - Responsive design
 */
export function Minimap({
  worldWidth,
  worldHeight,
  cameraX,
  cameraY,
  cameraZoom,
  rooms = [],
  agents = [],
  width = 200,
  height = 150,
  showZoomControls = true,
  onClick,
  onZoomChange,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [minimapZoom, setMinimapZoom] = useState(1.0);

  // Helper function to get room color by type
  const getRoomColor = (type: RoomInfo['type']): string => {
    const colors: Record<RoomInfo['type'], string> = {
      python: '#3776ab',
      javascript: '#f7df1e',
      typescript: '#3178c6',
      go: '#00add8',
      rust: '#ce422b',
      java: '#007396',
      other: '#6b7280',
    };
    return colors[type] || colors.other;
  };

  // Helper function to get agent color by state
  const getAgentColor = (state: AgentMarker['state']): string => {
    const colors: Record<AgentMarker['state'], string> = {
      active: '#22c55e', // Green
      idle: '#fbbf24', // Yellow
      thinking: '#60a5fa', // Blue
      offline: '#ef4444', // Red
    };
    return colors[state] || colors.offline;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply minimap zoom
    ctx.save();
    ctx.scale(minimapZoom, minimapZoom);

    const effectiveWidth = width / minimapZoom;
    const effectiveHeight = height / minimapZoom;

    // Draw world background
    ctx.fillStyle = '#2d4a3e';
    ctx.fillRect(0, 0, effectiveWidth, effectiveHeight);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1 / minimapZoom;

    const scaleX = effectiveWidth / worldWidth;
    const scaleY = effectiveHeight / worldHeight;

    // Vertical grid lines
    for (let x = 0; x < worldWidth; x += 100) {
      const scaledX = x * scaleX;
      ctx.beginPath();
      ctx.moveTo(scaledX, 0);
      ctx.lineTo(scaledX, effectiveHeight);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = 0; y < worldHeight; y += 100) {
      const scaledY = y * scaleY;
      ctx.beginPath();
      ctx.moveTo(0, scaledY);
      ctx.lineTo(effectiveWidth, scaledY);
      ctx.stroke();
    }

    // Draw rooms
    rooms.forEach((room) => {
      const roomX = room.x * scaleX;
      const roomY = room.y * scaleY;
      const roomWidth = room.width * scaleX;
      const roomHeight = room.height * scaleY;

      // Fill room with type color
      ctx.fillStyle = getRoomColor(room.type);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(roomX, roomY, roomWidth, roomHeight);

      // Draw room border
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = getRoomColor(room.type);
      ctx.lineWidth = 2 / minimapZoom;
      ctx.strokeRect(roomX, roomY, roomWidth, roomHeight);
    });

    // Draw agents
    agents.forEach((agent) => {
      const agentX = agent.x * scaleX;
      const agentY = agent.y * scaleY;
      const agentRadius = 3 / minimapZoom;

      // Draw agent circle
      ctx.fillStyle = getAgentColor(agent.state);
      ctx.beginPath();
      ctx.arc(agentX, agentY, agentRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw agent border for better visibility
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1 / minimapZoom;
      ctx.stroke();
    });

    // Draw camera viewport
    const viewportWidth = (effectiveWidth / cameraZoom) * scaleX;
    const viewportHeight = (effectiveHeight / cameraZoom) * scaleY;
    const viewportX = (cameraX * scaleX) - (viewportWidth / 2);
    const viewportY = (cameraY * scaleY) - (viewportHeight / 2);

    ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
    ctx.lineWidth = 2 / minimapZoom;
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);

    // Draw camera center point
    ctx.fillStyle = 'rgba(96, 165, 250, 1.0)';
    ctx.beginPath();
    ctx.arc(cameraX * scaleX, cameraY * scaleY, 3 / minimapZoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

  }, [worldWidth, worldHeight, cameraX, cameraY, cameraZoom, width, height, rooms, agents, minimapZoom]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onClick) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert minimap coordinates to world coordinates, accounting for minimap zoom
    const effectiveWidth = width / minimapZoom;
    const effectiveHeight = height / minimapZoom;
    const worldX = (x / effectiveWidth) * worldWidth;
    const worldY = (y / effectiveHeight) * worldHeight;

    onClick(worldX, worldY);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(minimapZoom + 0.2, 2.0);
    setMinimapZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(minimapZoom - 0.2, 0.5);
    setMinimapZoom(newZoom);
  };

  const handleResetZoom = () => {
    setMinimapZoom(1.0);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        style={{
          cursor: onClick ? 'pointer' : 'default',
          display: 'block',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: 4,
          backgroundColor: '#1a1a1a',
        }}
      />

      {showZoomControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 4,
            padding: 4,
          }}
        >
          <button
            onClick={handleZoomIn}
            disabled={minimapZoom >= 2.0}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 2,
              backgroundColor: minimapZoom >= 2.0 ? '#333' : '#60a5fa',
              color: '#fff',
              cursor: minimapZoom >= 2.0 ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={handleResetZoom}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 2,
              backgroundColor: '#60a5fa',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Reset Zoom"
          >
            1:1
          </button>
          <button
            onClick={handleZoomOut}
            disabled={minimapZoom <= 0.5}
            style={{
              width: 24,
              height: 24,
              border: 'none',
              borderRadius: 2,
              backgroundColor: minimapZoom <= 0.5 ? '#333' : '#60a5fa',
              color: '#fff',
              cursor: minimapZoom <= 0.5 ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Zoom Out"
          >
            -
          </button>
        </div>
      )}
    </div>
  );
}
