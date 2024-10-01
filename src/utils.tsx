export function convertManifestToGraph(manifest_json: any, show_tests: boolean): any {
  let nodes: { id: string, label: string, path: string, schema:string, centrality: number }[] = [];
  let links: { source: string, target: string }[] = [];

  // MANIFEST NODES
  Object.keys(manifest_json.nodes).forEach(function(key, index) {
    let node = manifest_json.nodes[key];
    if (!show_tests) {
      if (node.resource_type == "test") return;
    }

    // Generate Graph Nodes
    let parent_path = node.path.split("/").slice(0, -1).join("/");

    // allow mapping of input schemas to data states
    const mapping = new Map([
        ["staging", "raw"],
        ["landing","raw"],
        ["intermediate", "transformations"],
        ["facts", "modelling"],
        ["dims", "modelling"],
        ["marts", "serving"],
      ]
      )
    let new_schema = mapping.get(node.schema.toLowerCase())
    if (new_schema===undefined){
      nodes.push({
        id: node.unique_id, 
        label: node.name, 
        path: parent_path,
        schema: node.schema,
        centrality: 0
      });
    }
    else{
      nodes.push({
        id: node.unique_id, 
        label: node.name, 
        path: parent_path,
        schema: new_schema,
        centrality: 0
      })
    }
    // Generate Graph Edges
    node.depends_on?.nodes?.forEach(function(depend_on_node:any, index:number) {
      if (!show_tests) {
        if (depend_on_node.startsWith("test")) return; // hide "tests"
      }
      links.push({source: depend_on_node, target: key});
    });
  });

  // SOURCES NODES
  Object.keys(manifest_json.sources).forEach(function(key, index) {
    let source = manifest_json.sources[key];
    // Generate Graph Nodes
    let parent_path = source.path.split("/").slice(0, -1).join("/");

    const mapping = new Map([
      ["staging", "raw"],
      ["landing","raw"],
      ["intermediate", "transformations"],
      ["facts", "modelling"],
      ["dims", "modelling"],
      ["marts", "serving"],
    ]
    )
    let new_schema = mapping.get(source.schema.toLowerCase())
    if (new_schema===undefined){
      nodes.push({
        id: source.unique_id, 
        label: source.name, 
        path: parent_path,
        schema: source.schema,
        centrality: 0
      });
    }
    else{
      nodes.push({
        id: source.unique_id, 
        label: source.name, 
        path: parent_path,
        schema: new_schema,
        centrality: 0
      })
    }

  });

  // CALCULATE CENTRALITY FOR EACH NODE
  for (var i=0; i<links.length; i++) {
    let link = links[i];
    let source_node = nodes.find(node => node.id === link.source); // heavy
    let target_node = nodes.find(node => node.id === link.target); // heavy
    if (source_node) source_node.centrality++;
    if (target_node) target_node.centrality++;
  }

  let graph = {nodes: nodes, links: links};
  // console.log('Graph: ', graph);
  console.log("Nodes: ", nodes.length, "Edges: ", links.length, "Showing Tests: ", show_tests);
  return graph;
}

function compareArrays(arr1:string[], arr2:string[]) {
    const shared = arr1.filter(value => arr2.includes(value));
    const uniqueToArr1 = arr1.filter(value => !arr2.includes(value));
    const uniqueToArr2 = arr2.filter(value => !arr1.includes(value));
    return {shared, uniqueToArr1, uniqueToArr2};
}

export function convertManifestsToDiffGraph(base_manifest: any, target_manifest: any) {
  /*
  TODO:
    - Find an Example Data dataset that has changes in raw_code (e.g. a MatterMost PR).
      - Color Changed raw_code as orange.
      - Color Downstream Nodes of any changes (e.g. blue).
  */
  let nodes = [];
  let base_node_ids:string[] = [];
  let targ_node_ids:string[] = [];
  let links:any[] = [];

  // NODES (.sources + .nodes)
  // Determine Shared, and Unique to Base/Target (Deleted/Added)
  Object.keys(base_manifest.nodes).forEach(function(key, index) {base_node_ids.push(key)});
  Object.keys(base_manifest.sources).forEach(function(key, index) {base_node_ids.push(key)});
  Object.keys(target_manifest.nodes).forEach(function(key, index) {targ_node_ids.push(key)});
  Object.keys(target_manifest.sources).forEach(function(key, index) {targ_node_ids.push(key)});
  let comparison = compareArrays(base_node_ids, targ_node_ids);
  console.log('diff compare: ', comparison);
  nodes = [
    ...comparison.shared.map(id => ({id: id, color: 'white', label: id})),
    ...comparison.uniqueToArr1.map(id => ({id: id, color: 'red', label: id})),
    ...comparison.uniqueToArr2.map(id => ({id: id, color: 'green', label: id}))
  ];

  // Links = Just Target Links for now. (Future: Manage Base Links, and Deleted/Added Links too)
  Object.keys(target_manifest.nodes).forEach(function(key, index) {
    let node = target_manifest.nodes[key];
    // Generate Graph Edges
    node.depends_on?.nodes?.forEach(function(depend_on_node:any, index:number) {
      links.push({source: depend_on_node, target: key});
    });
  });
  // ~ Base Links as well: // Future Todo: Make this only  add an Edge if it doesn't already exist.
  Object.keys(base_manifest.nodes).forEach(function(key, index) {
    let node = base_manifest.nodes[key];
    // Generate Graph Edges
    node.depends_on?.nodes?.forEach(function(depend_on_node:any, index:number) {
      links.push({source: depend_on_node, target: key});
    });
  });

  let graph = {nodes: nodes, links: links};
  console.log("diff graph:", graph);
  return graph;
}

export function getManifestNodeDetails(id: string, manifesst_data: any): any { // and ManifestSourceDetails
  let manifest_elements = null;
  if (id.startsWith("source")) {
    manifest_elements = manifesst_data.sources;
  } else {
    manifest_elements = manifesst_data.nodes;
  }
  let node: any = manifest_elements![id];
  return node;
}

export function prettifyFilename(filename: string): string {
  let new_filename = filename.split(".").slice(0, -1).join("");
  new_filename = new_filename.split("_").join(" ");
  return new_filename;
}