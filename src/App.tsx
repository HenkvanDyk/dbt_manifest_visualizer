import { useRef, useState, useEffect } from 'react';
import { useDisclosure } from '@chakra-ui/react'
import { ChakraProvider, Box, Button, Center, Spinner, VStack, HStack, Stack, Text, Textarea, Checkbox, Divider, Tag, Icon, Heading, Code, Link } from '@chakra-ui/react';
import { Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuGroup, MenuOptionGroup, MenuDivider } from '@chakra-ui/react';
import { Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react'
import { Radio, RadioGroup } from '@chakra-ui/react'
import { useToast } from '@chakra-ui/react'
import { BsChevronDown, BsFileEarmarkCode, BsFillFileEarmarkCodeFill, BsPlusLg, BsEyeFill, BsFileEarmarkDiff, BsFileEarmarkDiffFill, BsXLg, BsBoxArrowUpRight, BsArrowClockwise } from 'react-icons/bs'
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton } from '@chakra-ui/react'

import ForceGraph3D from '3d-force-graph';
import * as utils from './utils';

// import * as THREE from 'three';
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

function Graph3D({
  viz_3d,
  viz_size_by_centrality,
  viz_overall_quality,
  viz_show_tests,
  viz_layout
}: {
  viz_3d: boolean;
  viz_size_by_centrality: boolean;
  viz_overall_quality: number;
  viz_show_tests: boolean;
  viz_layout: string;
}) {
  const example_manifest_files = [
    "manifest.json",
    "mattermost_pr1339_target_28c6f456.json",
    "hokkien_pr14_target.json",
    "tuva.json",
  ]

  const [loading_status_text, setLoadingStatusText] = useState<string | null>(null);
  const [selected_manifest, setSelectedManifest] = useState(example_manifest_files[0]); // selected_manifest_view
  const [manifest_data, setManifestData] = useState<any>(null);
  const [viz_text, setVizText] = useState<boolean>(false);
  const [show_info, setShowInfo] = useState<boolean>(false);
  const [cur_node_details, setCurNodeDetails] = useState<any | null>(null);
  const [loading_graph, setLoadingGraph] = useState<boolean>(false);
  const [graph_data, setGraphData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [times_graph_has_run, setTimesGraphHasRun] = useState<number>(0);

  const toast = useToast();

  // Manifest File -> Manifest Data
  useEffect(() => {
    if (!selected_manifest) return;
    // setLoadingStatusText(`1. Fetching Manifest: https://dbt.gitlabdata.com/manifest.json (48.1 MB)`);
    // setLoadingGraph(true);
    // fetch('https://dbt.gitlabdata.com/manifest.json')
    fetch(`/data/example_manifests/manifest.json`)
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
    setLoadingStatusText("2. Drawing Graph");
    let graphData = utils.convertManifestToGraph(manifest_data, viz_show_tests);
    setGraphData(graphData);
  }, [manifest_data]);

  // Graph Data -> ForceGraph3D
  useEffect(() => {
    if (containerRef.current == null) return;
    if (graph_data == null) return;

    setLoadingStatusText(null);
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
    setTimesGraphHasRun(times_graph_has_run + 1);


    const nodeClickHandler = (node: any) => {
      setCurNodeDetails(utils.getManifestNodeDetails(node.id, manifest_data));
      setShowInfo(true);
    }

    // Generate graph
    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graph_data)

      // display
      .numDimensions(viz_3d ? 3 : 2)
      // .nodeResolution(6) // default = 8
      .backgroundColor('#000003')
      .nodeLabel('label')
      .nodeAutoColorBy('schema')
      .nodeOpacity(1.0)

      // ix
      .onNodeClick(nodeClickHandler)
      .enableNodeDrag(false)

      // arrow head
      .linkDirectionalArrowLength(3.5)
      .linkDirectionalArrowRelPos(1)
    // .linkCurvature(0)

    // layout
    // .forceEngine('d3') // default 'd3' / 'ngraph'
    // .dagMode('lr') // <- For a more traditional DAG Left-to-Right layout.
    // .cooldownTicks(200)

    if (viz_overall_quality == 0) { Graph.nodeResolution(0) }
    if (viz_overall_quality == 1) { Graph.nodeResolution(4) }
    if (viz_overall_quality == 2) { Graph.nodeResolution(6) }
    if (viz_overall_quality == 3) { Graph.nodeResolution(8) }

    // directional particles
    if ([1, 2].includes(viz_overall_quality)) {
      Graph
        .linkDirectionalParticles(1) // ("value")
        .linkDirectionalParticleSpeed(0.008) //(d => d.value * 0.001);
        .linkDirectionalParticleWidth(1) // Nodes are ~width(10)
    }
    if ([3].includes(viz_overall_quality)) {
      Graph
        .linkDirectionalParticles(2) // ("value")
        .linkDirectionalParticleSpeed(0.008) //(d => d.value * 0.001);
        .linkDirectionalParticleWidth(1) // Nodes are ~width(10)
    }

    if (viz_layout == "tree-lr") {
      Graph.dagMode('lr') // <- For a more traditional DAG Left-to-Right layout.

      // Show Text Labels
      Graph
        .nodeThreeObject((node: any) => { // As Sprites
          const sprite: any = new SpriteText(node.label);
          sprite.material.depthWrite = false; // make sprite background transparent
          sprite.color = node.color;
          sprite.textHeight = 3;
          // sprite.backgroundColor = true;
          //sprite.position = new THREE.Vector3(0,1,0);
          sprite.position.set(0, -4, 0);
          return sprite;
        })
        .nodeRelSize(2) // default: 4
        .nodeThreeObjectExtend(true)

      Graph.
        dagLevelDistance(100)
    }
    if (viz_size_by_centrality) {
      Graph
        .nodeRelSize(2) // default 4
        .nodeVal((node: any) => Math.pow(node.centrality, 1.5))
    }
    if (viz_text) {
      // Label via Sprite
      Graph
        .nodeThreeObject((node: any) => { // As Sprites
          const sprite: any = new SpriteText(node.label);
          sprite.material.depthWrite = false; // make sprite background transparent
          sprite.color = node.color;
          sprite.textHeight = 3;
          // sprite.backgroundColor = true;
          //sprite.position = new THREE.Vector3(0,1,0);
          sprite.position.set(0, -4, 0);
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

    // FIT to canvas when engine stops - only for the initial load
    // let doneFirstLayout = false;
    // Graph.onEngineStop(() => {
    //   if (!doneFirstLayout) {
    //     doneFirstLayout = true;
    //     Graph.zoomToFit(400)
    //   }
    // });
  }, [containerRef.current, graph_data, viz_text]);

  return (
    <Box>

      {/* LOADING SPINNER */}
      {loading_graph && (
        <Center w="100%" h="100vh" position="fixed" top="0" pointerEvents="none">
          <VStack>
            <Spinner thickness='4px' emptyColor='gray.200' color='orange.500'
              size='xl' zIndex={-1} />
            <Text color="white">{loading_status_text || "Loading ..."}</Text>
            <Text color="white" fontSize='sm'>(Should take less than 10 seconds on a M3 Mac, on modern internet speeds.)</Text>
            <Text color="white" fontSize='sm'>(Please do not switch tabs whilst loading.)</Text>
          </VStack>
        </Center>
      )}

      {/* TOP BAR */}
      <HStack m={4}>
        <Button
          onClick={() => { window.open('https://large-dbt-dag-visualizer.replit.app/'); }}
          colorScheme="yellow"
        // variant="outline"
        // bgColor="rgba(0,0,0,0.8)"
        >
          Go to DAG Visualizer Tool <Icon as={BsBoxArrowUpRight} ml={2} />
        </Button>
        <Button
          onClick={() => { location.reload(); }}
          colorScheme="twitter"
          variant="outline"
          bgColor="rgba(0,0,0,0.8)"
        >
          Visualization Settings (Refresh) <Icon as={BsArrowClockwise} ml={2} />
        </Button>
      </HStack>

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

                    {/* Add Materialization Info */}
                  <VStack spacing={0} alignItems="baseline" my={2}>
                    <Text fontSize='sm' fontWeight="bold" textTransform="uppercase" opacity={0.6}>
                      Materialization
                    </Text>
                    <Text>
                      {cur_node_details.config?.materialized || "Not specified"}
                    </Text>
                  </VStack>
                  <Divider my={2} />

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
      <Box className="_graph" ref={containerRef} w="100%" h="100vh" position="fixed" top="0" left="0" zIndex={-2} bgColor="#000235" />

    </Box>
  );
}

export default function App() {
  const [should_start, setShouldStart] = useState<boolean>(false);
  const [viz_3d, setViz3d] = useState<boolean>(true);
  const [viz_size_by_centrality, setVizSizeByCentrality] = useState<boolean>(true);
  const [viz_overall_quality, setVizOverallQuality] = useState<number>(2);
  const [viz_show_tests, setVizShowTests] = useState<boolean>(false);
  const [viz_layout, setVizLayout] = useState<string>("force");

  useEffect(() => {
    if (viz_show_tests == true) {
      setVizOverallQuality(Math.max(viz_overall_quality - 1, 0));
    }
  }, [viz_show_tests])

  return (
    <ChakraProvider>
      {!should_start && (
        <Center bg='#000235' h='100vh'>
          <Box borderRadius={6} bg='white' w='480px' maxW='100%' m={4} p={4}>
            <Heading>GitLab DAG Visualizer</Heading>
            <Text lineHeight='150%' my={4}>
              This is a fork of <Link color='blue.500' href='https://large-dbt-dag-visualizer.replit.app/'>Large dbt Dag Visualizer</Link>. It's optimized for larger DAGs like GitLab (less visual effects).
            </Text>
            <Alert status='warning' borderRadius={4} my={4}>
              <AlertIcon />
              GitLab's DAG is 50mb. It is recommended to close other Tabs and CPU-heavy apps before starting the visualizer.
            </Alert>

            <Divider my={2} />
            <Box className="_visualization_settings" px={4}>
              <Text fontSize='md' fontWeight='bold' textTransform='uppercase'>Visualization Settings</Text>
              <Divider my={2} />
              <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Layout</Text>
              <RadioGroup onChange={(value) => {
                setVizLayout(value); setViz3d((value == 'force')); setVizSizeByCentrality((value == 'force'))
              }}
                value={viz_layout}
              >
                <Stack direction='row'>
                  <Radio value='force'>Force Graph</Radio>
                  <Radio value='tree-lr'>Tree DAG (LR) (Traditional)</Radio>
                </Stack>
              </RadioGroup>
              <Divider my={2} />
              <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Dimensions</Text>
              <RadioGroup onChange={(value) => { setViz3d(value == '3d') }} value={viz_3d ? '3d' : '2d'}>
                <Stack direction='row'>
                  <Radio value='3d'>3D</Radio>
                  <Radio value='2d'>2D</Radio>
                </Stack>
              </RadioGroup>
              <Divider my={2} />
              <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Node Size</Text>
              <RadioGroup
                onChange={(value) => { setVizSizeByCentrality(value == 'centrality') }}
                value={viz_size_by_centrality ? 'centrality' : 'constant'}
              >
                <Stack direction='row'>
                  <Radio value='centrality'># Dependencies + Children</Radio>
                  <Radio value='constant'>Constant</Radio>
                </Stack>
              </RadioGroup>
              <Divider my={2} />
              <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Overall Render Quality</Text>
              <RadioGroup
                onChange={(value) => { setVizOverallQuality(Number(value)) }}
                value={viz_overall_quality.toString()}
              >
                <Stack direction='row'>
                  <Radio value='3'>High</Radio>
                  <Radio value='2'>Medium</Radio>
                  <Radio value='1'>Low</Radio>
                  <Radio value='0'>Very Low</Radio>
                </Stack>
              </RadioGroup>
              {/* <Divider my={2} />
            <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>dbt Tests</Text>
            <RadioGroup 
              onChange={(value) => { setVizShowTests(value == 'show') }} 
              value={viz_show_tests ? 'show' : 'hide'}
            >
              <Stack direction='row'>
                <Radio value='hide'>Hide Test Nodes</Radio>
                <Radio value='show'>Show Test Nodes</Radio>
              </Stack>
            </RadioGroup> */}
            </Box>
            <Divider my={2} />

            <Button onClick={() => { setShouldStart(true) }} colorScheme='blue' w='100%' mt={6} my={2}>
              Start Visualizer
            </Button>
          </Box>
        </Center>

      )}
      {should_start && (
        <Graph3D
          viz_3d={viz_3d}
          viz_size_by_centrality={viz_size_by_centrality}
          viz_overall_quality={viz_overall_quality}
          viz_show_tests={viz_show_tests}
          viz_layout={viz_layout}
        />
      )}
    </ChakraProvider>
  )
}
