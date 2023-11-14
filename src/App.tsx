import { useRef, useState, useEffect } from 'react';
import { ChakraProvider, Box, Button, Center, Spinner } from '@chakra-ui/react';
import { Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuGroup, MenuOptionGroup, MenuDivider} from '@chakra-ui/react';
import { BsChevronDown, BsFileEarmarkCode, BsFillFileEarmarkCodeFill, BsPlusLg } from 'react-icons/bs'

import ForceGraph3D from '3d-force-graph';
import * as utils from '/utils';

function Graph3D() {
  const example_manifest_files = [
    // "hokkien_pr14_base_main.json",
    "hokkien_pr14_target.json",
    // "mattermost_pr1339_base_77bab5dc.json",
    "mattermost_pr1339_target_28c6f456.json",
    "tuva.json"
  ]
  // ToDo: Add 'Diff' Manifest files.

  const [selected_manifest, setSelectedManifest] = useState(example_manifest_files[0]);
  const [manifest_data, setManifestData] = useState<any>(null);

  const [show_info, setShowInfo] = useState<boolean>(false);
  const [loading_graph, setLoadingGraph] = useState<boolean>(false);
  const [graph_data, setGraphData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Manifest File -> Manifest Data
  useEffect(() => {
    setLoadingGraph(true);
    fetch(`/data/example_manifests/${selected_manifest}`)
      .then((response) => response.json())
      .then((data) => {
        setManifestData(data);
      });
  }, [selected_manifest]);

  // Manifest Data -> Graph Data
  useEffect(() => {
    if (!manifest_data) return;
    let graphData = utils.convertManifestToGraph(manifest_data);
    setGraphData(graphData);
  }, [manifest_data]);

  useEffect(() => {
    console.log('show_info', show_info);
  }, [setShowInfo]);
  
  // Graph Data -> ForceGraph3D
  useEffect(() => {
    if (containerRef.current == null) return;
    if (graph_data == null) return;

    setLoadingGraph(false);

    const nodeClickHandler = (node) => {
      console.log("Hello!");
      setShowInfo(true);
    }
    
    // Generate graph
    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graph_data)
      .numDimensions(3)
      .onNodeClick(nodeClickHandler)
      // display
      .backgroundColor('#000003')
      .nodeLabel('label')
      .nodeAutoColorBy('path')
      .nodeOpacity(1.0)
      // arrow head
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
      .linkCurvature(0)
      // directional particles
      .linkDirectionalParticles(3) // ("value")
      .linkDirectionalParticleSpeed(0.008) //(d => d.value * 0.001);
      .linkDirectionalParticleWidth(1) // Nodes are ~width(10)
      // layout
      .forceEngine('d3') // default 'd3' / 'ngraph'
      // .dagMode('lr') // <- For a more traditional DAG Left-to-Right layout.
      .cooldownTicks(200)
      // Label via Sprite
      // .nodeThreeObject(node => { // As Sprites
      //   const sprite = new SpriteText(node.label);
      //   sprite.material.depthWrite = false; // make sprite background transparent
      //   sprite.color = node.color;
      //   sprite.textHeight = 3;
      //   return sprite;
      // });
      //  Label via CSS2D
      // .nodeThreeObject(node => {
      //   const nodeEl = document.createElement('div');
      //   nodeEl.textContent = node.label;
      //   nodeEl.style.color = node.color;
      //   nodeEl.style.fontSize = '8px';
      //   nodeEl.className = 'node-label';
      //   return new CSS2DObject(nodeEl);
      // })
      // .nodeThreeObjectExtend(true)

      // fit to canvas when engine stops - only for the initial load
      let doneFirstLayout = false;
      Graph.onEngineStop(() => {
        if (!doneFirstLayout) {
          doneFirstLayout = true;
          Graph.zoomToFit(400)
        }
      });
  }, [containerRef.current, graph_data]);

  return (
    <>
      <Menu m={4}>
        <MenuButton as={Button} rightIcon={<BsChevronDown />}>
          Manifest: {utils.prettifyFilename(selected_manifest)}
        </MenuButton>
        <MenuList>
          <MenuGroup title='Manifest Snapshots'>
            {example_manifest_files.map((filename: string) => (
              <MenuItem key={filename} 
                icon={(selected_manifest == filename) ? <BsFillFileEarmarkCodeFill /> : <BsFileEarmarkCode />}
                onClick={() => {
                  setSelectedManifest(filename);
                }}
              >
                Demo: {utils.prettifyFilename(filename)}
              </MenuItem>
            ))}
            <MenuItem icon={<BsPlusLg />}>Paste my own dbt manifest.json</MenuItem>
          </MenuGroup>
          <MenuDivider />
          <MenuGroup title='Manifest Diffs'>
            <MenuItem>…</MenuItem>
            <MenuItem icon={<BsPlusLg />}>Paste 2 dbt manifest.json files</MenuItem>
          </MenuGroup>
        </MenuList>
      </Menu>
      {loading_graph && (
        <Center w="100%" h="100vh" position="fixed" top="0">
          <Spinner thickness='4px' emptyColor='gray.200' color='orange.500'
            size='xl' zIndex={-1} />
        </Center>
      )}
      {show_info && (
        <Box className="_info" h="100vh" position="fixed" top="0" right="0" w="240px" bg="white">
          Hello
          <Button onClick={setShowInfo(false)}>Close</Button>
        </Box>
      )}
      <Box className="_graph" ref={containerRef} w="100%" h="100vh" position="fixed" top="0" left="0" zIndex={-2} />
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