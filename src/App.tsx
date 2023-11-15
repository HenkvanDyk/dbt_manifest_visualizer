import { useRef, useState, useEffect } from 'react';
import { useDisclosure } from '@chakra-ui/react'
import { ChakraProvider, Box, Button, Center, Spinner, VStack, HStack, Stack, Text, Textarea, Checkbox, Divider, Tag, Icon } from '@chakra-ui/react';
import { Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuGroup, MenuOptionGroup, MenuDivider } from '@chakra-ui/react';
import {Alert, AlertIcon, AlertTitle, AlertDescription} from '@chakra-ui/react'
import { Radio, RadioGroup } from '@chakra-ui/react'
import { useToast } from '@chakra-ui/react'
import { BsChevronDown, BsFileEarmarkCode, BsFillFileEarmarkCodeFill, BsPlusLg, BsEyeFill, BsFileEarmarkDiff, BsFileEarmarkDiffFill } from 'react-icons/bs'
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

    Optimize Code:
    - It seems that things slow down if WebGL graphs are altered too many times (their data sources or visual properties are changed). This implies that the WebGL graphs might not be getting cleared from RAM.
*/

function Graph3D() {
  const example_manifest_files = [
    "hokkien_pr14_target.json",
    "tuva.json",
    // "mattermost_pr1339_base_77bab5dc.json",
    "mattermost_pr1339_target_28c6f456.json",
    // "hokkien_pr14_base_main.json",
    
  ]
  const example_manifest_diffs = [
    {"base": "hokkien_pr14_base_main.json", "target":"hokkien_pr14_target.json"},
    {"base": "mattermost_pr1339_base_77bab5dc.json", "target":"mattermost_pr1339_target_28c6f456.json"}, // +8 nodes
    // {"base": "mattermost_pr1339_base_77bab5dc.json", "target":"mattermost_base_30c827e0.json"}, // no diff
    // {"base": "mattermost_pr1339_target_28c6f456.json", "target":"mattermost_base_30c827e0.json"}, //-8 nodes
  ]

  const [display_type, setDisplayType] = useState<string>(["manifest_view", "manifest_diff", "user_manifest_view"][0]);
  const [selected_manifest, setSelectedManifest] = useState(example_manifest_files[0]); // selected_manifest_view
  const [selected_manifest_diff_id, setSelectedManifestDiffId] = useState<number>(-1);
  const [manifest_data, setManifestData] = useState<any>(null);
  const [manifest_diff_base_data, setManifestDiffBaseData] = useState<any>(null);
  const [manifest_diff_target_data, setManifestDiffTargetData] = useState<any>(null);
  const [viz_bloom_on, setVizBloomOn] = useState<boolean>(true);
  const [viz_3d, setViz3d] = useState<boolean>(true);
  const [viz_text, setVizText] = useState<boolean>(false);
  const [viz_layout, setVizLayout] = useState<string>("force");
  const [show_info, setShowInfo] = useState<boolean>(false);
  const [info_details, setInfoDetails] = useState<string | null>(null);
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
  
  useEffect(() => {
    if (selected_manifest_diff_id == -1) return;

    let pair = example_manifest_diffs[selected_manifest_diff_id];
    
    setLoadingGraph(true);
    fetch(`/data/example_manifests/${pair.base}`)
      .then((response) => response.json())
      .then((base_data) => {
        setManifestDiffBaseData(base_data);

        fetch(`/data/example_manifests/${pair.target}`)
          .then((response) => response.json())
          .then((target_data) => {
            setManifestDiffTargetData(target_data);
          });
      });
  }, [selected_manifest_diff_id]);
  

  // User Submitted Manifest Data
  function onSubmittedManifestData(user_manifest_data: any) {
    setLoadingGraph(true);
    setDisplayType("user_manifest_view");
    setManifestData(user_manifest_data);
  }

  // Manifest Data -> Graph Data
  useEffect(() => {
    if (display_type == "manifest_view" || display_type == "user_manifest_view") { // triggered by manifest_data ∂
      if (!manifest_data) return;
      let graphData = utils.convertManifestToGraph(manifest_data);
      setGraphData(graphData);
    }
    if (display_type == "manifest_diff") { // triggered by manifest_diff_target_data ∂
      if (!manifest_diff_base_data) return; //~
      if (!manifest_diff_target_data) return;
      let diffGraph = utils.convertManifestsToDiffGraph(manifest_diff_base_data, manifest_diff_target_data);
      setGraphData(diffGraph);
    }
  }, [manifest_data, manifest_diff_target_data, viz_3d, viz_layout]);

  // Graph Data -> ForceGraph3D
  useEffect(() => {
    if (containerRef.current == null) return;
    if (graph_data == null) return;

    setLoadingGraph(false);

    if (times_graph_has_run > 5) {
      toast({
        title: 'Running slow? Refresh the page',
        description: "The code isn't optimized for switching graphs yet 😅. Refresh to clear the memory.",
        position: 'top-center',
        status: 'warning',
        duration: 8000,
        isClosable: true,
      });
    }
    setTimesGraphHasRun(times_graph_has_run+1);
    

    const nodeClickHandler = (node: any) => {
      if (display_type == "manifest_diff") {
        setInfoDetails(utils.getManifestNodeDetails(node.id, manifest_diff_target_data));
      } else {
        setInfoDetails(utils.getManifestNodeDetails(node.id, manifest_data));
      }
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
    <>
      {/* TOP BAR */}
      <HStack m={2}>
        <Menu>
          <MenuButton as={Button} rightIcon={<BsChevronDown />} colorScheme="yellow">
            {display_type == "user_manifest_view" && (
              "Manifest: Custom"
            )}
            {display_type == "manifest_view" && (
              `Manifest: ${utils.prettifyFilename(selected_manifest)}`
            )}
            {display_type == "manifest_diff" && (
              `Diff: ${utils.prettifyFilename(example_manifest_diffs[selected_manifest_diff_id].base)} ↔
              ${utils.prettifyFilename(example_manifest_diffs[selected_manifest_diff_id].target)}`
            )}
          </MenuButton>
          <MenuList>
            <MenuGroup title='Manifest Views'>
              {example_manifest_files.map((filename: string) => (
                <MenuItem key={filename}
                  icon={(selected_manifest == filename && display_type == "manifest_view") ? <BsFillFileEarmarkCodeFill /> : <BsFileEarmarkCode />}
                  onClick={() => {
                    setDisplayType("manifest_view");
                    setSelectedManifest(filename);
                  }}
                >
                  Demo: {utils.prettifyFilename(filename)}
                </MenuItem>
              ))}
              <MenuItem icon={<BsPlusLg />}
                onClick={pasteManifestModalDisclosure.onOpen}
              >
                Paste a dbt manifest.json
              </MenuItem>
            </MenuGroup>
            <MenuDivider />
            <MenuGroup title='Manifest Diffs'>
              {example_manifest_diffs.map((entry: any, index: number) => (
                <MenuItem key={index} 
                  icon={
                    (selected_manifest_diff_id == index && display_type == "manifest_diff") ?  
                    <BsFileEarmarkDiffFill /> : <BsFileEarmarkDiff />
                  }
                  onClick={() => {
                    setDisplayType("manifest_diff");
                    setSelectedManifestDiffId(index);
                    toast({
                      title: 'Calculating PR Diff',
                      description: "Please wait a few seconds ...",
                      status: 'info',
                      duration: 5000,
                      isClosable: true,
                    })
                  }}
                >
                  {entry.base} ↔<br/>
                  {entry.target}
                </MenuItem>
              ))}
              <MenuItem icon={<BsPlusLg />}
                onClick={messageAlertModalDisclosure.onOpen}>
                Paste 2 dbt manifest.json files
              </MenuItem>
            </MenuGroup>
          </MenuList>
        </Menu>
        <Button onClick={pasteManifestModalDisclosure.onOpen} 
          // border="2px solid #AAA"
          colorScheme="twitter"
          variant="outline"
          bgColor="rgba(0,0,0,0.8)"
          // colorScheme="black" color="white" variant="outline"
        >
          Paste a Manifest File
        </Button>
      </HStack>

      {/* BOTTOM BAR */}
      <HStack m={2} mb={6} position="fixed" bottom={0}>
        <Button onClick={visualizationSettingsModalDisclosure.onOpen}
          colorScheme="blue"
          variant="ghost"
        >
          <HStack spacing={1}>
            <Icon as={BsEyeFill} />
            <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">{viz_3d ? "3D" : "2D"}</Tag>
            <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">{viz_layout} Layout</Tag>
            <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">Showing All</Tag>
            <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">Colored by Folder</Tag>
            <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">Labels {viz_text ? "On" : "Off"}</Tag>
            {viz_bloom_on && (
              <Tag variant='outline' colorScheme='blue' bgColor="rgba(0,0,0,0.8)">Bloom On</Tag>
            )}
          </HStack>
        </Button>
      </HStack>

      {/* LOADING SPINNER */}
      {loading_graph && (
        <Center w="100%" h="100vh" position="fixed" top="0" pointerEvents="none">
          <Spinner thickness='4px' emptyColor='gray.200' color='orange.500'
            size='xl' zIndex={-1} />
        </Center>
      )}

      {/* INFO PANEL */}
      {show_info && (
        <Box className="_info" h="100vh" position="fixed" top="0" right="0" w="240px" bg="white">
          <VStack textAlign="left" p={4}>
            <Box>
              {info_details || <Spinner />}
            </Box>
            <Button onClick={() => { setShowInfo(false) }} w="100%">Close</Button>
          </VStack>
        </Box>
      )}

      {/* GRAPH */}
      <Box className="_graph" ref={containerRef} w="100%" h="100vh" position="fixed" top="0" left="0" zIndex={-2} />

      {/* MODALS */}
      <MessageAlertModal
        isOpen={messageAlertModalDisclosure.isOpen}
        onOpen={messageAlertModalDisclosure.onOpen}
        onClose={messageAlertModalDisclosure.onClose}
        title={"Manifest Diffs is a WIP"}
        message={"Custom Manifest Diffs is currently a work-in-progress and not yet available. 🙇"}
      />
      <PasteManifestModal
        isOpen={pasteManifestModalDisclosure.isOpen}
        onOpen={pasteManifestModalDisclosure.onOpen}
        onClose={pasteManifestModalDisclosure.onClose}
        onSubmittedManifestData={onSubmittedManifestData}
      />
      <VisualizationSettingsModal
        isOpen={visualizationSettingsModalDisclosure.isOpen}
        onOpen={visualizationSettingsModalDisclosure.onOpen}
        onClose={visualizationSettingsModalDisclosure.onClose}
        viz_bloom_on={viz_bloom_on}
        setVizBloomOn={setVizBloomOn}
        viz_3d={viz_3d}
        setViz3d={setViz3d}
        viz_layout={viz_layout}
        setVizLayout={setVizLayout}
        viz_text={viz_text}
        setVizText={setVizText}
      />

    </>
  );
}

function VisualizationSettingsModal({
  isOpen, onOpen, onClose,
  viz_bloom_on, setVizBloomOn,
  viz_3d, setViz3d,
  viz_layout, setVizLayout,
  viz_text, setVizText
}): {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  viz_bloom_on: boolean; setVizBloomOn: (on: boolean) => void;
  viz_3d: boolean; setViz3d: (on: boolean) => void;
  viz_layout: string; setVizLayout: (value: string) => void;
  viz_text: boolean; setVizText: (on: boolean) => void;
} {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Visualization Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Bloom</Text>
          <Checkbox isChecked={viz_bloom_on}
            onChange={(e) => setVizBloomOn(e.target.checked)}
          >
            Bloom Effect (Disable for faster rendering)
          </Checkbox>
          <Divider my={2} />
          <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Dimensions</Text>
          <RadioGroup onChange={(value) => { setViz3d(value == '3d') }} value={viz_3d ? '3d' : '2d'}>
            <Stack direction='row'>
              <Radio value='3d'>3D</Radio>
              <Radio value='2d'>2D</Radio>
            </Stack>
          </RadioGroup>
          <Divider my={2} />
          <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Layout</Text>
          <RadioGroup onChange={(value) => { setVizLayout(value) }} value={viz_layout}>
            <Stack direction='row'>
              <Radio value='force'>Force Graph</Radio>
              <Radio value='tree-lr'>Tree DAG (LR)</Radio>
            </Stack>
          </RadioGroup>
          <Divider my={2} />
          <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Colored by</Text>
          <Text>Folder Hierarchy</Text>
          <Divider my={2} />
          <Text fontSize='sm' fontWeight='bold' textTransform='uppercase'>Show Labels</Text>
          <Checkbox isChecked={viz_text}
            onChange={(e) => setVizText(e.target.checked)}
          >
            Show Labels
          </Checkbox>
          <Divider my={2} />
          <Text>… Todo: More Settings, like different Layouts …</Text>
          <Divider my={2} />
          <Alert status='warning' fontSize='sm' borderRadius={8}>
            <AlertIcon />
            Note: This experiment doesn't currently clear its RAM with each new layout, so if things get slow, just refresh the page. :)
          </Alert>
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button mr={3} onClick={onClose} w='100%'>
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function PasteManifestModal({
  isOpen, onOpen, onClose, onSubmittedManifestData
}): {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onSubmittedManifestData?: (manifest_json: any) => void;
} {
  let [value, setValue] = useState('');

  let handleInputChange = (e) => {
    let inputValue = e.target.value
    setValue(inputValue);
  }

  function onSubmit() {
    // console.log('value:', value);
    try {
      const obj = JSON.parse(value);
      console.log('PasteManifestModal: obj:', obj);
      if (onSubmittedManifestData) onSubmittedManifestData(obj);
      onClose();
    } catch (err) {
      alert('JSON is invalid');
      console.error(err);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Paste a dbt Manifest</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text fontSize='sm'>Copy and Paste a dbt Manifest file. The default location of the manifest file is: <kbd>dbt-project/target/manifest.json</kbd>.</Text>
          <Textarea my={2}
            onChange={handleInputChange}
            placeholder='Paste manifest.json content in here'
            size='md'
          />
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button mr={3} onClick={onClose} w='100%'>
              Cancel
            </Button>
            <Button colorScheme='blue' mr={3} onClick={onSubmit} w='100%'>
              See DAG
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

function MessageAlertModal({
  isOpen, onOpen, onClose,
  title, message
}): {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  title: string;
  message: string;
} {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text>{message}</Text>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme='blue' mr={3} onClick={onClose} w='100%'>
            Ok
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default function App() {
  return (
    <ChakraProvider>
      <Graph3D />
    </ChakraProvider>
  )
}