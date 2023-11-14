export function convertManifestToGraph(manifest_json: any): any {
  let nodes: { id: string, label: string, path: string }[] = [];
  let links: { source: string, target: string }[] = [];

  let manifest_nodes = manifest_json.nodes;
  Object.keys(manifest_nodes).forEach(function(key, index) {
    let node = manifest_nodes[key];
    // if (node.resource_type == "test") return; // hide "tests"

    // Generate Graph Nodes
    let parent_path = node.path.split("/").slice(0, -1).join("/");
    nodes.push({id: node.unique_id, label: node.name, path: parent_path});
    // Generate Graph Edges
    node.depends_on?.nodes?.forEach(function(depend_on_node, index) {
      // if (depend_on_node.startsWith("test")) return; // hide "tests"
      links.push({source: depend_on_node, target: key});
    });
  });

  Object.keys(manifest_json.sources).forEach(function(key, index) {
    let source = manifest_json.sources[key];
    // Generate Graph Nodes
    let parent_path = source.path.split("/").slice(0, -1).join("/");
    nodes.push({id: source.unique_id, label: source.name, path: parent_path});
  });

  let graph = {nodes: nodes, links: links};
  console.log(graph);
  return graph;
}

export function getManifestNodeDetails(id: string, manifesst_json: any): string { // and ManifestSourceDetails
  let manifest_elements = null;
  if (id.startsWith("source")) {
    manifest_elements = manifesst_json.sources;
  } else {
    manifest_elements = manifesst_json.nodes;
  }
  
  let node: any = manifest_elements![id];
  if (!node) return 'n/a';
  
  let details = `
<div>${node.name}</div>
<ul>
  <li>type: ${node.resource_type}</li>
  <li>path: ${node.original_file_path}</li>
  <li>description: ${node.description || node.source_description}</li>
  <li>...todo: more details...</li>
</ul>
  `;
  return details;
}

export function prettifyFilename(filename: string): string {
  let new_filename = filename.split(".").slice(0, -1).join("");
  new_filename = new_filename.split("_").join(" ");
  return new_filename;
}