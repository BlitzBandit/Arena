import { getHexNeighbors, getHexDistance } from './hexMath';

// --- NEW: A lightning-fast Flood Fill to test map connectivity ---
const countReachable = (map, startCoord) => {
  const queue = [startCoord];
  const visited = new Set([startCoord]);
  let count = 0;

  while (queue.length > 0) {
    const curr = queue.shift();
    count++; // Count every grass tile we successfully walk on
    
    const [q, r] = curr.split(',').map(Number);
    const neighbors = getHexNeighbors(q, r);
    
    for (const [nq, nr] of neighbors) {
      const neighborCoord = `${nq},${nr}`;
      // Only spread to tiles that exist, are traversable, and haven't been counted yet
      if (map[neighborCoord] && map[neighborCoord].traversable && !visited.has(neighborCoord)) {
        visited.add(neighborCoord);
        queue.push(neighborCoord);
      }
    }
  }
  return count;
};

export const generateMap = (maxRadius, targetTileCount) => {
  const map = {};
  const candidates = new Set(); 

  // 1. Generate a PURE GRASS island first
  const placeTile = (q, r) => {
    const types = ["grass_1", "grass_2", "grass_3"];
    const type = types[Math.floor(Math.random() * types.length)];
    map[`${q},${r}`] = { type, traversable: true };

    const neighbors = getHexNeighbors(q, r);
    for (const [nq, nr] of neighbors) {
      const neighborCoord = `${nq},${nr}`;
      if (!map[neighborCoord] && getHexDistance(0, 0, nq, nr) <= maxRadius) {
        candidates.add(neighborCoord);
      }
    }
  };

  placeTile(0, 0);

  while (Object.keys(map).length < targetTileCount && candidates.size > 0) {
    const candidatesArray = Array.from(candidates);
    const randomIndex = Math.floor(Math.random() * candidatesArray.length);
    const chosenCoord = candidatesArray[randomIndex];

    candidates.delete(chosenCoord);
    
    const [q, r] = chosenCoord.split(',').map(Number);
    placeTile(q, r); 
  }

  // 2. SAFELY sprinkle rocks using Flood Fill validation
  const allCoords = Object.keys(map);
  const targetRocks = Math.floor(targetTileCount * 0.15); // Aim for 15% rocks
  let placedRocks = 0;

  // Shuffle the coordinates array so we test random spots
  const shuffledCoords = allCoords.sort(() => Math.random() - 0.5);

  for (const coord of shuffledCoords) {
    if (coord === "0,0") continue; // Never put a rock exactly on the center
    if (placedRocks >= targetRocks) break; // We hit our 15% quota

    // Temporarily make it a rock
    const originalType = map[coord].type;
    map[coord] = { type: "rock", traversable: false };

    // Test the map: Total Grass should equal Target Tile Count minus the rocks we've placed
    const expectedGrassCount = targetTileCount - placedRocks - 1; 
    const reachableCount = countReachable(map, "0,0");

    if (reachableCount === expectedGrassCount) {
      // The map is still fully connected! Keep the rock.
      placedRocks++;
    } else {
      // The rock blocked a path! Revert it back to grass immediately.
      map[coord] = { type: originalType, traversable: true };
    }
  }

  return map;
};