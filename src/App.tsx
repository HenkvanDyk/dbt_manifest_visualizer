import { useRef, useState, useEffect } from 'react';
import { useDisclosure } from '@chakra-ui/react'
import { ChakraProvider, Box, Button, Center, Spinner, VStack, HStack, Stack, Text, Textarea, Checkbox, Divider, Tag, Icon, Heading, Code } from '@chakra-ui/react';
import { Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuGroup, MenuOptionGroup, MenuDivider } from '@chakra-ui/react';
import {Alert, AlertIcon, AlertTitle, AlertDescription} from '@chakra-ui/react'
import { Radio, RadioGroup } from '@chakra-ui/react'
import { useToast } from '@chakra-ui/react'
import { BsChevronDown, BsFileEarmarkCode, BsFillFileEarmarkCodeFill, BsPlusLg, BsEyeFill, BsFileEarmarkDiff, BsFileEarmarkDiffFill, BsXLg } from 'react-icons/bs'
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton } from '@chakra-ui/react'

import ForceGraph3D from '3d-force-graph';
import * as utils from './utils';

import * as THREE from 'three';
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import SpriteText from 'three-spritetext';

/* TODO: 
    Fork '3d-force-graph' and write custom WebGL/ThreeJS code for:
    - Custom Camera Control (2D, Node-based Camera Navigation, etc.)
    - Custom Layouts (More traditional DAG layouts)
    - Custom Rendering (Distance-based Labeling)
    - Custom Expand/Collapsing of Nodes
    - Node Highlighting (Though this could probably be done without customizing)

    Optimize Code:
    - It seems that things slow down if WebGL graphs are altered too many times (their data sources or visual properties are changed). This implies that the WebGL graphs might not be getting cleared from RAM.
*/

function Graph3D() {
  const example_manifest_files = [
    "hokkien_pr14_target.json",
    "mattermost_pr1339_target_28c6f456.json",
    "tuva.json",
  ]
  
  const [selected_manifest, setSelectedManifest] = useState(example_manifest_files[0]); // selected_manifest_view
  const [manifest_data, setManifestData] = useState<any>(null);
  const [viz_bloom_on, setVizBloomOn] = useState<boolean>(true);
  const [viz_3d, setViz3d] = useState<boolean>(true);
  const [viz_text, setVizText] = useState<boolean>(false);
  const [viz_layout, setVizLayout] = useState<string>("force");
  const [show_info, setShowInfo] = useState<boolean>(false);
  const [cur_node_details, setCurNodeDetails] = useState<any | null>(null);
  const [loading_graph, setLoadingGraph] = useState<boolean>(false);
  const [graph_data, setGraphData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [times_graph_has_run, setTimesGraphHasRun] = useState<number>(0);

  const messageAlertModalDisclosure = useDisclosure();
  const pasteManifestModalDisclosure = useDisclosure();
  const visualizationSettingsModalDisclosure = useDisclosure();
  const toast = useToast();

  // Manifest File -> Manifest Data
  useEffect(() => {
    setLoadingGraph(true);
    fetch(`/data/example_manifests/${selected_manifest}`)
      .then((response) => response.json())
      .then((manifest_data) => {
        setManifestData(manifest_data);
      });
  }, [selected_manifest]);
  

  // User Submitted Manifest Data
  function onSubmittedManifestData(user_manifest_data: any) {
    setLoadingGraph(true);
    setManifestData(user_manifest_data);
  }

  // Manifest Data -> Graph Data
  useEffect(() => {
    if (!manifest_data) return;
    let graphData = utils.convertManifestToGraph(manifest_data);
    setGraphData(graphData);
  }, [manifest_data]);

  // Graph Data -> ForceGraph3D
  useEffect(() => {
    if (containerRef.current == null) return;
    if (graph_data == null) return;

    setLoadingGraph(false);

    if (times_graph_has_run > 5) {
      toast({
        title: 'Running slow? Refresh the page',
        description: "The code isn't optimized for switching graphs yet 😅. Refresh to clear the memory.",
        position: 'top',
        status: 'warning',
        duration: 8000,
        isClosable: true,
      });
    }
    setTimesGraphHasRun(times_graph_has_run+1);
    

    const nodeClickHandler = (node: any) => {
      setCurNodeDetails(utils.getManifestNodeDetails(node.id, manifest_data));
      setShowInfo(true);
    }

    // Generate graph
    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graph_data)
      .numDimensions(viz_3d ? 3 : 2)
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


    if (viz_text) {
      // Label via Sprite
        Graph
          .nodeThreeObject(node => { // As Sprites
            const sprite = new SpriteText(node.label);
            sprite.material.depthWrite = false; // make sprite background transparent
            sprite.color = node.color;
            sprite.textHeight = 3;
            // sprite.backgroundColor = true;
            //sprite.position = new THREE.Vector3(0,1,0);
            sprite.position.set(0,-4,0);
            return sprite;
          })
          .nodeRelSize(2) // default: 4
          .nodeThreeObjectExtend(true)
      
      
      //  Label via CSS2D
      // .nodeThreeObject(node => {
      //   const nodeEl = document.createElement('div');
      //   nodeEl.textContent = node.label;
      //   nodeEl.style.color = node.color;
      //   nodeEl.style.fontSize = '8px';
      //   nodeEl.className = 'node-label';
      //   return new CSS2DObject(nodeEl);
      // })
        //.nodeThreeObjectExtend(true)
    }
    if (viz_layout == "tree-lr") {
      Graph.dagMode('lr') // <- For a more traditional DAG Left-to-Right layout.
    }

    if (viz_bloom_on) {
      const bloomPass = new UnrealBloomPass();
      bloomPass.strength = 3;
      bloomPass.radius = 1;
      bloomPass.threshold = 0;
      Graph.postProcessingComposer().addPass(bloomPass);
    }

    // FIT to canvas when engine stops - only for the initial load
    // let doneFirstLayout = false;
    // Graph.onEngineStop(() => {
    //   if (!doneFirstLayout) {
    //     doneFirstLayout = true;
    //     Graph.zoomToFit(400)
    //   }
    // });
  }, [containerRef.current, graph_data, viz_bloom_on, viz_text]);

  return (
    <Box>

      {/* LOADING SPINNER */}
      {loading_graph && (
        <Center w="100%" h="100vh" position="fixed" top="0" pointerEvents="none">
          <Spinner thickness='4px' emptyColor='gray.200' color='orange.500'
            size='xl' zIndex={-1} />
        </Center>
      )}

      {/* INFO PANEL */}
      {show_info && (
        <Box className="_info_wrapper" h="100vh" position="fixed" top="0" right="0" w="25%" minW="320px" maxW="480px" p={4}>
          <Box className="_info" bg="white" h="100%" borderRadius={8} overflow="auto">
            <VStack p={4} alignItems="baseline">
              {cur_node_details && (
                <>
                  <HStack w="100%" className="header">
                    <VStack flex={1} alignItems="baseline" spacing={0}>
                      <Text fontSize='xs' opacity={0.6}>
                        {cur_node_details.original_file_path.split("/").slice(0, -1).join("/")}
                      </Text>
                      <Text fontSize='lg' fontWeight='bold' overflowWrap="anywhere">
                        {cur_node_details.name}
                      </Text>
                      <Text fontSize='xs' opacity={0.6}>
                        {cur_node_details.resource_type == "test" && ("🧪 ")}
                        {cur_node_details.resource_type == "source" && ("📥 ")}
                        {cur_node_details.resource_type}
                      </Text>
                    </VStack>
                    <Button onClick={() => { setShowInfo(false) }} variant="ghost">
                      <Icon as={BsXLg} />
                    </Button>
                  </HStack>

                  <VStack spacing={0} alignItems="baseline" my={2}>
                    <Text fontSize='sm' fontWeight="bold" textTransform="uppercase" opacity={0.6}>
                      Description
                    </Text>
                    <Text>
                      {cur_node_details.description || cur_node_details.source_description || "none"}
                    </Text>
                  </VStack>
                  <Divider my={2} />

                  {cur_node_details.columns && (
                  <>
                    <VStack spacing={0} alignItems="baseline" my={2} position="relative">
                      <Text fontSize='sm' fontWeight="bold" textTransform="uppercase" opacity={0.6}>
                        Columns
                      </Text>
                      {Object.keys(cur_node_details.columns).length == 0 && (<Text>none</Text>)}
                      {Object.keys(cur_node_details.columns).map((key: string, index: number) => (
                        <Text key={key}>{key}</Text>
                      ))}
                    </VStack>
                    <Divider my={2} />
                    </>
                  )}
                  

                  <VStack spacing={0} alignItems="baseline" my={2} position="relative">
                    <Text fontSize='sm' fontWeight="bold" textTransform="uppercase" opacity={0.6}>
                      Code
                    </Text>
                    <Code maxHeight="240px" overflow="auto" borderRadius={4} maxWidth="100%">
                      {cur_node_details.raw_code || "none"}
                    </Code>
                  </VStack>
                  <Divider my={2} />
                  
                  
                </>
              )}
              {!cur_node_details && (
                <Spinner />
              )}
              <Button onClick={() => { setShowInfo(false) }} w="100%">Close</Button>
            </VStack>
          </Box>
        </Box>
      )}

      {/* GRAPH */}
      <Box className="_graph" ref={containerRef} w="100%" h="100vh" position="fixed" top="0" left="0" zIndex={-2} bgColor="#333" />

    </Box>
  );
}

export default function App() {
  return (
    <ChakraProvider>
      <Graph3D />
    </ChakraProvider>
  )
}