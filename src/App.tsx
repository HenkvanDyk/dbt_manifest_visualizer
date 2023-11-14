import { useRef, useState, useEffect } from 'react';
import { useDisclosure } from '@chakra-ui/react'
import { ChakraProvider, Box, Button, Center, Spinner, VStack, HStack, Text, Textarea } from '@chakra-ui/react';
import { Menu, MenuButton, MenuList, MenuItem, MenuItemOption, MenuGroup, MenuOptionGroup, MenuDivider} from '@chakra-ui/react';
import { BsChevronDown, BsFileEarmarkCode, BsFillFileEarmarkCodeFill, BsPlusLg } from 'react-icons/bs'
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, ModalCloseButton } from '@chakra-ui/react'

import ForceGraph3D from '3d-force-graph';
import * as utils from '/utils';

// import * as THREE from 'three';
// import { UnrealBloomPass } from 'https://unpkg.com/three/examples/jsm/postprocessing/UnrealBloomPass.js';

function Graph3D() {
  const example_manifest_files = [
    // "hokkien_pr14_base_main.json",
    "hokkien_pr14_target.json",
    // "mattermost_pr1339_base_77bab5dc.json",
    "mattermost_pr1339_target_28c6f456.json",
    "tuva.json"
  ]
  // ToDo: Add 'Diff' Manifest files.

  const [showing_user_manifest, setShowingUserManifest] = useState<boolean>(false);
  const [selected_manifest, setSelectedManifest] = useState(example_manifest_files[0]);
  const [manifest_data, setManifestData] = useState<any>(null);

  const [show_info, setShowInfo] = useState<boolean>(false);
  const [info_details, setInfoDetails] = useState<string | null>(null);
  const [loading_graph, setLoadingGraph] = useState<boolean>(false);
  const [graph_data, setGraphData] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const messageAlertModalDisclosure = useDisclosure();
  const pasteManifestModalDisclosure = useDisclosure();

  // Manifest File -> Manifest Data
  useEffect(() => {
    setLoadingGraph(true);
    fetch(`/data/example_manifests/${selected_manifest}`)
      .then((response) => response.json())
      .then((data) => {
        setManifestData(data);
      });
  }, [selected_manifest]);

  // User Submitted Manifest Data
  function onSubmittedManifestData(user_manifest_data: any) {
    setLoadingGraph(true);
    setShowingUserManifest(true);
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

    const nodeClickHandler = (node) => {
      console.log("Hello!");
      setInfoDetails(utils.getManifestNodeDetails(node.id, manifest_data));
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

      // const bloomPass = new UnrealBloomPass();
      // console.log('asdfadsf');
      // bloomPass.strength = 3;
      // bloomPass.radius = 1;
      // bloomPass.threshold = 0;
      // Graph.postProcessingComposer().addPass(bloomPass);

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
      <HStack m={2}>
        <Menu>
          <MenuButton as={Button} rightIcon={<BsChevronDown />}>
            Manifest: {showing_user_manifest ? "Custom" : utils.prettifyFilename(selected_manifest)}
          </MenuButton>
          <MenuList>
            <MenuGroup title='Manifest Snapshots'>
              {example_manifest_files.map((filename: string) => (
                <MenuItem key={filename} 
                  icon={(selected_manifest == filename && !showing_user_manifest) ? <BsFillFileEarmarkCodeFill /> : <BsFileEarmarkCode />}
                  onClick={() => {
                    setShowingUserManifest(false);
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
              <MenuItem>…</MenuItem>
              <MenuItem icon={<BsPlusLg />} 
                onClick={messageAlertModalDisclosure.onOpen}>
                Paste 2 dbt manifest.json files
              </MenuItem>
            </MenuGroup>
          </MenuList>
        </Menu>
        <Button onClick={pasteManifestModalDisclosure.onOpen}>Paste a Manifest File</Button>
      </HStack>
      {loading_graph && (
        <Center w="100%" h="100vh" position="fixed" top="0" pointerEvents="none">
          <Spinner thickness='4px' emptyColor='gray.200' color='orange.500'
            size='xl' zIndex={-1} />
        </Center>
      )}
      {show_info && (
        <Box className="_info" h="100vh" position="fixed" top="0" right="0" w="240px" bg="white">
          <VStack textAlign="left" p={4}>
            <Box>
              {info_details || <Spinner />}
            </Box>
            <Button onClick={() => {setShowInfo(false)}} w="100%">Close</Button>
          </VStack>
        </Box>
      )}
      <Box className="_graph" ref={containerRef} w="100%" h="100vh" position="fixed" top="0" left="0" zIndex={-2} />

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
    </>
  );
}

function PasteManifestModal({
  isOpen, onOpen, onClose, onSubmittedManifestData
}) : {
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
    } catch(err) {
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
}) : {
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