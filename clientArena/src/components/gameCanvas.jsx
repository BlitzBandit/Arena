import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useResponsiveCanvas } from '../hooks/useResponsiveCanvas';
import { SPRITES } from '../sprites';
// We only need the geometric math now!
import { axialToPixel, pixelToAxial, getHexDistance } from '../utils/hexMath';

export default function GameCanvas({ 
  spriteSheet, mapData, playerPos, activePath, drawnPath, 
  isPlayerSelected, onHexClick, onPathStart, onPathHover, onPathEnd 
}) {
  const camera = useRef({ x: 0, y: 0, zoom: 0.6 });
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);
  const hoveredHex = useRef(null);

  // NEW: State ref to tell the mouse what type of drag we are doing
  const isDrawingPath = useRef(false);

  const charPixelPos = useRef(null); 
  const charFacingIdx = useRef(0); 
  const isMoving = useRef(false);

  const currentPathQueue = useRef([]);
  const targetNode = useRef(null);
  const currentVisualHex = useRef(playerPos);

  const hexWidth = 128; 
  const hexFaceHeight = 88; 

  // ... KEEP getFacingFrame EXACTLY THE SAME ...
  const getFacingFrame = (angleDeg) => {
    if (angleDeg >= 112.5 && angleDeg < 157.5) return 0; 
    if (angleDeg >= 67.5 && angleDeg < 112.5) return 1;  
    if (angleDeg >= 22.5 && angleDeg < 67.5) return 2;   
    if (angleDeg >= -22.5 && angleDeg < 22.5) return 3;  
    if (angleDeg >= -67.5 && angleDeg < -22.5) return 4; 
    if (angleDeg >= -112.5 && angleDeg < -67.5) return 5; 
    if (angleDeg >= -157.5 && angleDeg < -112.5) return 6; 
    return 7; 
  };

  useEffect(() => {
    if (!isMoving.current) {
      currentVisualHex.current = playerPos;
    }
  }, [playerPos]);

  useEffect(() => {
    if (activePath && activePath.length > 1) {
      currentPathQueue.current = [...activePath]; 
      currentVisualHex.current = currentPathQueue.current[0];
      currentPathQueue.current.shift(); 
      targetNode.current = currentPathQueue.current.shift(); 
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

    // --- CHARACTER MOVEMENT MATH ---
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
        charPixelPos.current.x = targetPixel.x;
        charPixelPos.current.y = targetPixel.y;
        currentVisualHex.current = targetNode.current;
        
        if (currentPathQueue.current.length > 0) {
          targetNode.current = currentPathQueue.current.shift();
        } else {
          targetNode.current = null;
          isMoving.current = false;
        }
      }
    } else {
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
      
      const [pQ, pR] = (currentVisualHex.current || playerPos).split(',').map(Number);
      const distFromPlayer = getHexDistance(pQ, pR, q, r);

      let hexSprite = SPRITES.hexes[tile.type];
      
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

      if (distFromPlayer <= 4) {
        // 2. Draw Hand-Drawn Path OR Basic Hover
        if (drawnPath && drawnPath.includes(coordString) && coordString !== playerPos) {
          
          // Check if the entire path is over the 3-step limit
          const isPathTooLong = drawnPath.length > 4;

          if (isPathTooLong) {
            // TEMPORARY DEBUG: Force a raw, programmatic red shape
            context.beginPath();
            context.moveTo(x + hexWidth / 2, y);                 
            context.lineTo(x + hexWidth, y + hexFaceHeight / 2); 
            context.lineTo(x + hexWidth / 2, y + hexFaceHeight); 
            context.lineTo(x, y + hexFaceHeight / 2);            
            context.closePath();
            context.fillStyle = 'rgba(255, 0, 0, 0.5)'; 
            context.fill();
          } else {
            // Normal Yellow Sprite
            context.drawImage(
              spriteSheet,
              SPRITES.overlays.yellow.sx, SPRITES.overlays.yellow.sy, SPRITES.overlays.yellow.sWidth, SPRITES.overlays.yellow.sHeight,
              x, y, hexWidth, hexWidth
            );
          }

        } else if (coordString === hoveredHex.current && !isDrawingPath.current) {
          // Just a basic white highlight for mouse hovering
          context.drawImage(
            spriteSheet,
            SPRITES.overlays.white.sx, SPRITES.overlays.white.sy, SPRITES.overlays.white.sWidth, SPRITES.overlays.white.sHeight,
            x, y, hexWidth, hexWidth
          );
        }

        // 3. Draw Selection Ring
        if (coordString === playerPos && isPlayerSelected) {
          context.drawImage(
            spriteSheet,
            SPRITES.overlays.white.sx, SPRITES.overlays.white.sy, SPRITES.overlays.white.sWidth, SPRITES.overlays.white.sHeight,
            x, y, hexWidth, hexWidth
          );
        }
      }
    });

    // DRAW WARLOCK 
    if (playerPos && charPixelPos.current) {
      const warlockSprite = SPRITES.warlock.frames[charFacingIdx.current]; 
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
    context.fillText(`Path Length: ${Math.max(0, drawnPath.length - 1)} / 3`, 20, 30);
    context.fillText(`Status: ${isDrawingPath.current ? 'DRAWING PATH' : (isPlayerSelected ? 'READY' : 'IDLE')}`, 20, 50);

  }, [spriteSheet, sortedMapArray, playerPos, isPlayerSelected, drawnPath]);

  const canvasRef = useResponsiveCanvas(drawGame);

  // --- NEW INPUT HANDLERS ---
  const handleMouseDown = (e) => {
    // THE FIX: Just clicking the Warlock starts drawing. No pre-selection needed!
    if (hoveredHex.current === playerPos && !isMoving.current) {
      isDrawingPath.current = true;
      onPathStart(hoveredHex.current);
      return; 
    }

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

    // If we are currently tracing a path, update the array and ignore the camera pan
    if (isDrawingPath.current) {
      if (hoveredHex.current) onPathHover(hoveredHex.current);
      return; 
    }

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
    // If we were drawing a path, releasing the mouse executes it
    if (isDrawingPath.current) {
      onPathEnd();
      isDrawingPath.current = false;
      return;
    }

    // Otherwise, handle normal clicks (like selecting the warlock)
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
      onMouseLeave={handleMouseUp} // Also fire mouse up if they drag off screen
      onWheel={handleWheel}
    />
  );
}