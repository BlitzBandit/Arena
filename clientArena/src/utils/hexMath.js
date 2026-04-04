// Converts an Axial coordinate (q, r) into screen pixel coordinates
export const axialToPixel = (q, r, hexWidth, hexFaceHeight) => {
  const x = (q * hexWidth) + (r * hexWidth * 0.5);
  const y = (r * hexFaceHeight * 0.75);
  return { x, y };
};

// Calculates the exact number of grid steps between two hexes
export const getHexDistance = (q1, r1, q2, r2) => {
  return (Math.abs(q1 - q2) + Math.abs(q1 + r1 - (q2 + r2)) + Math.abs(r1 - r2)) / 2;
};

// --- PATHFINDING MATH ---

// Gets the 6 adjacent axial coordinates
export const getHexNeighbors = (q, r) => {
  return [
    [q + 1, r], [q + 1, r - 1], [q, r - 1],
    [q - 1, r], [q - 1, r + 1], [q, r + 1]
  ];
};

// Breadth-First Search that returns the full array of coordinates
export const findPath = (startCoord, targetCoord, mapData) => {
  if (startCoord === targetCoord) return [startCoord];
  
  if (!mapData[targetCoord] || !mapData[targetCoord].traversable) return null;

  // Now we store the full path array in the queue
  const queue = [{ coord: startCoord, path: [startCoord] }];
  const visited = new Set([startCoord]);

  while (queue.length > 0) {
    const { coord, path } = queue.shift();
    
    // We found it! Return the path array (e.g., ["0,0", "0,1", "1,1"])
    if (coord === targetCoord) return path;

    const [q, r] = coord.split(',').map(Number);
    const neighbors = getHexNeighbors(q, r);

    for (const [nq, nr] of neighbors) {
      const neighborCoord = `${nq},${nr}`;
      
      if (mapData[neighborCoord] && mapData[neighborCoord].traversable && !visited.has(neighborCoord)) {
        visited.add(neighborCoord);
        // Create a new array with the new step added to the end
        queue.push({ coord: neighborCoord, path: [...path, neighborCoord] });
      }
    }
  }

  // No path found
  return null; 
};

// Converts screen pixels back into an Axial coordinate string (e.g., "1,2")
export const pixelToAxial = (worldX, worldY, hexWidth, hexFaceHeight) => {
  const fracRow = worldY / (hexFaceHeight * 0.75);
  const fracCol = (worldX - fracRow * (hexWidth * 0.5)) / hexWidth;

  let q = fracCol;
  let r = fracRow;
  let s = -q - r;

  let rq = Math.round(q);
  let rr = Math.round(r);
  let rs = Math.round(s);

  const q_diff = Math.abs(rq - q);
  const r_diff = Math.abs(rr - r);
  const s_diff = Math.abs(rs - s);

  if (q_diff > r_diff && q_diff > s_diff) {
      rq = -rr - rs;
  } else if (r_diff > s_diff) {
      rr = -rq - rs;
  }

  return `${rq},${rr}`;
};