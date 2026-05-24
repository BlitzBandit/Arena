import { useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { generateMap } from './utils/mapGenerator';
// We no longer need findPath for movement, just distance checking!
import { getHexDistance } from './utils/hexMath';
import './App.css';

function App() {
  const [spriteSheet, setSpriteSheet] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [playerPos, setPlayerPos] = useState("0,0"); 
  const [isPlayerSelected, setIsPlayerSelected] = useState(false);
  const [activePath, setActivePath] = useState(null);
  
  // NEW: Track the path the user is physically drawing
  const [drawnPath, setDrawnPath] = useState([]);

  useEffect(() => {
    const img = new Image();
    img.src = '/assets/texture_atlas.png'; 
    img.onload = () => setSpriteSheet(img);

    const newMap = generateMap(6, 75); 
    setMapData(newMap);

    let furthestCoord = "0,0";
    let maxDist = -1;

    for (const [coordString, tileData] of Object.entries(newMap)) {
      if (tileData.traversable) {
        const [q, r] = coordString.split(',').map(Number);
        const dist = getHexDistance(0, 0, q, r);

        if (dist > maxDist) {
          maxDist = dist;
          furthestCoord = coordString;
        }
      }
    }

    setPlayerPos(furthestCoord);
  }, []);

  // Standard click just handles selecting/deselecting the Warlock now
  const handleHexClick = (targetCoord) => {
    if (!isPlayerSelected) {
      if (targetCoord === playerPos) setIsPlayerSelected(true);
      return; 
    }
    
    // If they click anywhere else while selected (instead of dragging), deselect
    setIsPlayerSelected(false); 
  };

  // --- NEW DRAG-TO-MOVE LOGIC ---
  const handlePathStart = (startCoord) => {
    setDrawnPath([startCoord]);
  };

  const handlePathHover = (hoverCoord) => {
    setDrawnPath(prev => {
      if (prev.length === 0) return prev;
      
      const lastHex = prev[prev.length - 1];
      if (hoverCoord === lastHex) return prev; 
      
      if (prev.length > 1 && hoverCoord === prev[prev.length - 2]) {
        return prev.slice(0, -1);
      }

      const isTraversable = mapData[hoverCoord]?.traversable;
      const [lQ, lR] = lastHex.split(',').map(Number);
      const [hQ, hR] = hoverCoord.split(',').map(Number);
      const dist = getHexDistance(lQ, lR, hQ, hR);
      const alreadyInPath = prev.includes(hoverCoord);

      // THE FIX: Removed the length restriction so you can trace as far as you want
      if (dist === 1 && isTraversable && !alreadyInPath) {
        return [...prev, hoverCoord];
      }
      
      return prev;
    });
  };

  const handlePathEnd = () => {
    // THE FIX: Only execute the move if the path is 3 steps or less (array length 4)
    if (drawnPath.length > 1 && drawnPath.length <= 4) {
      const destination = drawnPath[drawnPath.length - 1];
      setPlayerPos(destination);
      setActivePath([...drawnPath]); 
    }
    
    setIsPlayerSelected(false);
    setDrawnPath([]); 
  };

  return (
    <div className="game-container">
      <GameCanvas 
        spriteSheet={spriteSheet} 
        mapData={mapData} 
        playerPos={playerPos}
        activePath={activePath} 
        drawnPath={drawnPath} // Pass the drawn path down
        isPlayerSelected={isPlayerSelected}
        onHexClick={handleHexClick}
        onPathStart={handlePathStart}
        onPathHover={handlePathHover}
        onPathEnd={handlePathEnd}
      />
    </div>
  );
}

export default App;