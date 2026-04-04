import { useEffect, useState } from 'react';
import GameCanvas from './components/gameCanvas';
import { generateMap } from './utils/mapGenerator';
// Import our newly upgraded function
import { findPath, getHexDistance } from './utils/hexMath';
import './App.css';

function App() {
  const [spriteSheet, setSpriteSheet] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [playerPos, setPlayerPos] = useState("0,0"); 
  const [isPlayerSelected, setIsPlayerSelected] = useState(false);
  
  // NEW: State to hold the physical walking path
  const [activePath, setActivePath] = useState(null);

  useEffect(() => {
    const img = new Image();
    img.src = '/assets/texture_atlas.png'; 
    img.onload = () => setSpriteSheet(img);

    // 1. Generate the map
    const newMap = generateMap(5, 70); 
    setMapData(newMap);

    // 2. Find the furthest tile from the center (0,0)
    let furthestCoord = "0,0";
    let maxDist = -1;

    for (const coordString of Object.keys(newMap)) {
      const [q, r] = coordString.split(',').map(Number);
      const dist = getHexDistance(0, 0, q, r);

      if (dist > maxDist) {
        maxDist = dist;
        furthestCoord = coordString;
      }
    }

    // 3. Spawn the Warlock at the edge of the world!
    setPlayerPos(furthestCoord);
  }, []);

  const handleHexClick = (targetCoord) => {
    if (!isPlayerSelected) {
      if (targetCoord === playerPos) setIsPlayerSelected(true);
      return; 
    }

    if (targetCoord === playerPos) {
      setIsPlayerSelected(false);
      return;
    }

    // Generate the roadmap
    const path = findPath(playerPos, targetCoord, mapData);

    // path.length - 1 gives us the actual number of steps moved
    if (path && (path.length - 1) <= 3) {
      setPlayerPos(targetCoord);
      setActivePath(path); // Send the roadmap to the canvas to animate
    } 
    
    setIsPlayerSelected(false); 
  };

  return (
    <div className="game-container">
      <GameCanvas 
        spriteSheet={spriteSheet} 
        mapData={mapData} 
        playerPos={playerPos}
        activePath={activePath} // Pass the path down
        isPlayerSelected={isPlayerSelected}
        onHexClick={handleHexClick}
      />
    </div>
  );
}

export default App;