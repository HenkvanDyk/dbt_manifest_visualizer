import './App.css'

import React, { useRef, useEffect } from 'react';
import { Box } from '@chakra-ui/react';

import ForceGraph3D from '3d-force-graph';

function Graph3D() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Graph Data
    const N = 300;
    const graphData = {
      nodes: [...Array(N).keys()].map(i => ({ id: i })),
      links: [...Array(N).keys()]
        .filter(id => id)
        .map(id => ({
          source: id,
          target: Math.round(Math.random() * (id-1))
        }))
    };

    // Generate graph
    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graphData);
  }, []);

  return (
    <Box ref={containerRef} w="100%" h="100vh" />
  );
}

export default function App() {
  return (
    <main>
      <Graph3D />
    </main>
  )
}