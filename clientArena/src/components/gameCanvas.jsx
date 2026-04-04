import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useResponsiveCanvas } from '../hooks/useResponsiveCanvas';
import { SPRITES } from '../sprites';
// Update import to findPath
import { axialToPixel, pixelToAxial, findPath, getHexDistance } from '../utils/hexMath';

// Added activePath to props
export default function GameCanvas({ spriteSheet, mapData, playerPos, activePath, isPlayerSelected, onHexClick }) {
  const camera = useRef({ x: 0, y: 0, zoom: 0.6 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const hoveredHex = useRef(null);

  const charPixelPos = useRef(null); 
  const charFacingIdx = useRef(0); 
  const isMoving = useRef(false);

  const currentPathQueue = useRef([]);
  const targetNode = useRef(null);

  // NEW: Track where the character physically is for the Fog of War
  const currentVisualHex = useRef(playerPos);

  // NEW: Sync the visual hex if the player isn't moving (like on initial load)
  useEffect(() => {
    if (!isMoving.current) {
      currentVisualHex.current = playerPos;
    }
  }, [playerPos]);

  const hexWidth = 128; 
  const hexFaceHeight = 88; 

  const getFacingFrame = (angleDeg) => {
    if (angleDeg >= 112.5 && angleDeg < 157.5) return 0; // SW
    if (angleDeg >= 67.5 && angleDeg < 112.5) return 1;  // S
    if (angleDeg >= 22.5 && angleDeg < 67.5) return 2;   // SE
    if (angleDeg >= -22.5 && angleDeg < 22.5) return 3;  // E
    if (angleDeg >= -67.5 && angleDeg < -22.5) return 4; // NE
    if (angleDeg >= -112.5 && angleDeg < -67.5) return 5; // N
    if (angleDeg >= -157.5 && angleDeg < -112.5) return 6; // NW
    return 7; // W
  };

  // NEW: When App.jsx sends a new path, set up the animation queue
  // NEW: When App.jsx sends a new path, set up the animation queue
  useEffect(() => {
    if (activePath && activePath.length > 1) {
      currentPathQueue.current = [...activePath]; 
      
      // THE FIX: Instantly pin the fog tracker to the START of the path 
      // before the animation even begins to completely prevent the visual flash!
      currentVisualHex.current = currentPathQueue.current[0];

      currentPathQueue.current.shift(); // Remove the start node (we are already there)
      targetNode.current = currentPathQueue.current.shift(); // Set the first immediate target
      isMoving.current = true;
    }
  }, [activePath]);

  const sortedMapArray = useMemo(() => {
    if (!mapData) return [];
    return Object.entries(mapData).sort((a, b) => {
      const [colA, rowA] = a[0].split(',').map(Number);
      const [colB, rowB] = b[0].split(',').map(Number);
      if (rowA !== rowB) return rowA - rowB;
      return colA - colB;
    });
  }, [mapData]);

  const drawGame = useCallback((context, width, height) => {
    context.fillStyle = '#1e2124'; 
    context.fillRect(0, 0, width, height);
    if (!spriteSheet || sortedMapArray.length === 0) return; 

    context.save(); 
    context.translate(width / 2, height / 2); 
    context.scale(camera.current.zoom, camera.current.zoom); 
    context.translate(camera.current.x, camera.current.y); 

    // --- CHARACTER MOVEMENT MATH (Point-to-Point) ---
    if (targetNode.current) {
      const [tQ, tR] = targetNode.current.split(',').map(Number);
      const targetPixel = axialToPixel(tQ, tR, hexWidth, hexFaceHeight);

      if (!charPixelPos.current) {
        charPixelPos.current = { x: targetPixel.x, y: targetPixel.y };
      }

      const dx = targetPixel.x - charPixelPos.current.x;
      const dy = targetPixel.y - charPixelPos.current.y;
      const distToTarget = Math.sqrt(dx * dx + dy * dy);

      if (distToTarget > 3) {
        const speed = 2; 
        charPixelPos.current.x += (dx / distToTarget) * speed;
        charPixelPos.current.y += (dy / distToTarget) * speed;

        const angleRads = Math.atan2(dy, dx);
        const angleDeg = angleRads * (180 / Math.PI);
        charFacingIdx.current = getFacingFrame(angleDeg);
      } else {
        // We reached the current mini-target!
        charPixelPos.current.x = targetPixel.x;
        charPixelPos.current.y = targetPixel.y;
        
        // THE FIX: Update the visual center for the Fog of War!
        currentVisualHex.current = targetNode.current;
        
        // Grab the next node in the path, or stop if we are done
        if (currentPathQueue.current.length > 0) {
          targetNode.current = currentPathQueue.current.shift();
        } else {
          targetNode.current = null;
          isMoving.current = false;
        }
      }
    } else {
      // Safety catch: if we aren't moving, ensure we are snapped to playerPos
      const [pQ, pR] = playerPos.split(',').map(Number);
      const exactPixel = axialToPixel(pQ, pR, hexWidth, hexFaceHeight);
      if (charPixelPos.current) {
         charPixelPos.current.x = exactPixel.x;
         charPixelPos.current.y = exactPixel.y;
      } else {
         charPixelPos.current = { x: exactPixel.x, y: exactPixel.y };
      }
    }

    // --- DRAW MAP ---
    sortedMapArray.forEach(([coordString, tile]) => {
      const [q, r] = coordString.split(',').map(Number);
      const { x, y } = axialToPixel(q, r, hexWidth, hexFaceHeight);
      
      // THE FIX: Calculate distance from the animated position, not the final destination
      const [pQ, pR] = (currentVisualHex.current || playerPos).split(',').map(Number);
      const distFromPlayer = getHexDistance(pQ, pR, q, r);

      // 1. Draw Map Tile (Apply Fog of War)
      let hexSprite = SPRITES.hexes[tile.type];
      
      // If it's too far away, overwrite the graphic with the fog sprite
      if (distFromPlayer > 4) {
        hexSprite = SPRITES.hexes.fog;
      }

      if (hexSprite) {
        context.drawImage(
          spriteSheet,
          hexSprite.sx, hexSprite.sy, hexSprite.sWidth, hexSprite.sHeight,
          x, y, hexWidth, hexWidth 
        );
      }

      // We only allow hovering and interaction if the tile is visible (NOT in fog)
      if (distFromPlayer <= 4) {
        // 2. Draw Sprite-Based Hover Highlight
        if (coordString === hoveredHex.current) {
          let activeOverlay = SPRITES.overlays.white; 

          if (isPlayerSelected) {
            const path = findPath(playerPos, hoveredHex.current, mapData);
            
            if (!path || (path.length - 1) > 3) {
              activeOverlay = SPRITES.overlays.red;
            } else {
              activeOverlay = SPRITES.overlays.yellow;
            }
          }

          if (activeOverlay) {
            context.drawImage(
              spriteSheet,
              activeOverlay.sx, activeOverlay.sy, activeOverlay.sWidth, activeOverlay.sHeight,
              x, y, hexWidth, hexWidth
            );
          }
        }

        // 3. Draw Selection Ring
        if (coordString === playerPos && isPlayerSelected) {
          const activeOverlay = SPRITES.overlays.white;
          context.drawImage(
            spriteSheet,
            activeOverlay.sx, activeOverlay.sy, activeOverlay.sWidth, activeOverlay.sHeight,
            x, y, hexWidth, hexWidth
          );
        }
      }
    });

    // DRAW WARLOCK (Outside the map loop to stay on top)
    if (playerPos && charPixelPos.current) {
      const warlockSprite = SPRITES.warlock.frames[charFacingIdx.current]; 
      
      // THE FIX: Slower rhythm (/ 150) and a higher bounce (* 8)
      const walkBob = isMoving.current ? Math.abs(Math.sin(Date.now() / 75)) * 8 : 0;
      
      const charDrawX = charPixelPos.current.x + (hexWidth / 2) - (warlockSprite.sWidth / 2);
      const charDrawY = charPixelPos.current.y + (hexFaceHeight / 2) - warlockSprite.sHeight + 36 - walkBob; 

      context.drawImage(
        spriteSheet,
        warlockSprite.sx, warlockSprite.sy, warlockSprite.sWidth, warlockSprite.sHeight,
        charDrawX, charDrawY, warlockSprite.sWidth, warlockSprite.sHeight
      );
    }

    context.restore(); 
    
    // Debug UI
    context.fillStyle = 'white';
    context.font = '16px monospace';
    context.textAlign = 'left';
    context.fillText(`Hovered: ${hoveredHex.current || 'None'}`, 20, 30);
    context.fillText(`Warlock Pos: ${playerPos}`, 20, 50);
    context.fillText(`Status: ${isPlayerSelected ? 'READY TO MOVE' : 'IDLE'}`, 20, 70);

  }, [spriteSheet, sortedMapArray, playerPos, isPlayerSelected]);

  // ... (Keep canvasRef and ALL mouse/wheel handlers EXACTLY the same) ...
  const canvasRef = useResponsiveCanvas(drawGame);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    hasDragged.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    const worldX = (e.clientX - canvas.clientWidth / 2) / camera.current.zoom - camera.current.x;
    const worldY = (e.clientY - canvas.clientHeight / 2) / camera.current.zoom - camera.current.y;
    
    const rawX = worldX - (hexWidth / 2);
    const rawY = worldY - (hexFaceHeight / 2);

    hoveredHex.current = pixelToAxial(rawX, rawY, hexWidth, hexFaceHeight);

    if (!isDragging.current) return;
    
    if (!hasDragged.current) {
      const totalDx = e.clientX - dragStartPos.current.x;
      const totalDy = e.clientY - dragStartPos.current.y;
      if (Math.abs(totalDx) > 3 || Math.abs(totalDy) > 3) {
        hasDragged.current = true;
      }
    }

    const dx = (e.clientX - lastMousePos.current.x) / camera.current.zoom;
    const dy = (e.clientY - lastMousePos.current.y) / camera.current.zoom;
    camera.current.x += dx;
    camera.current.y += dy;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    if (isDragging.current && !hasDragged.current && hoveredHex.current && mapData && !isMoving.current) {
      if (mapData[hoveredHex.current]) {
        onHexClick(hoveredHex.current);
      }
    }
    isDragging.current = false;
    hasDragged.current = false;
  };
  
  const handleWheel = (e) => {
    const zoomSensitivity = 0.0015;
    let newZoom = camera.current.zoom - (e.deltaY * zoomSensitivity);
    camera.current.zoom = Math.max(0.5, Math.min(newZoom, 4)); 
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="game-canvas" 
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    />
  );
}