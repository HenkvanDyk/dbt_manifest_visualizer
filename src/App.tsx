import { useRef, useState, useEffect } from 'react';
import { ChakraProvider, Box, Button } from '@chakra-ui/react';

import ForceGraph3D from '3d-force-graph';

function Graph3D() {
  const [graph_data, setGraphData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Init - Initial Dummy Graph Data
  useEffect(() => {
    if (!graph_data) {
      const N = 300;
      const graphData = {
        nodes: [...Array(N).keys()].map(i => ({ id: i })),
        links: [...Array(N).keys()]
          .filter(id => id)
          .map(id => ({
            source: id,
            target: Math.round(Math.random() * (id - 1))
          }))
      };
      setGraphData(graphData);
    }
  }, [graph_data])

  // Generate Graph - When Graph Data Changes
  useEffect(() => {
    if (containerRef.current == null) return;
    if (graph_data == null) return;
    
    // Generate graph
    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graph_data);
  }, [containerRef.current, graph_data]);

  return (
    <>
      <Button onClick={() => { console.log("Hello") }}>Hello</Button>
      <Box ref={containerRef} w="100%" h="100vh" />
    </>
  );
}

export default function App() {
  return (
    <ChakraProvider>
      
      <Graph3D />
    </ChakraProvider>
  )
}