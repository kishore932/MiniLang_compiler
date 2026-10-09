function isNode(value) {
  return Boolean(value) && typeof value === 'object';
}

function getChildNodes(node) {
  if (!isNode(node)) return [];

  if (Array.isArray(node.children)) {
    return node.children.filter(isNode).map((child, index) => [`[${index}]`, child]);
  }

  return Object.entries(node).flatMap(([key, value]) => {
    if (['type', 'line', 'column', 'value', 'name', 'inferredType', 'numericType', 'operator'].includes(key)) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.filter(isNode).map((child, index) => [`${key}[${index}]`, child]);
    }
    if (isNode(value)) {
      return [[key, value]];
    }
    return [];
  });
}

function getNodeLabel(node) {
  if (!isNode(node)) return 'Node';
  const type = node.type || 'Node';
  if (node.name) return `${type}: ${node.name}`;
  if (node.value !== undefined && node.value !== null && typeof node.value !== 'object') {
    return `${type}: ${node.value}`;
  }
  if (node.operator) return `${type}: ${node.operator}`;
  return type;
}

function TreeNode({ node, expandAll, depth }) {
  const children = getChildNodes(node);
  const loc = node?.line && node?.column ? `${node.line}:${node.column}` : '';
  const meta = [];
  if (node?.inferredType) meta.push(`type: ${node.inferredType}`);
  if (node?.numericType) meta.push(`num: ${node.numericType}`);

  if (children.length === 0) {
    return (
      <div className="lc-tree-leaf">
        <span className="lc-tree-label">{getNodeLabel(node)}</span>
        {meta.length > 0 && <span className="lc-tree-meta">{meta.join(' · ')}</span>}
        {loc && <span className="lc-tree-loc">{loc}</span>}
      </div>
    );
  }

  return (
    <details className="lc-tree-node" open={expandAll || depth < 1}>
      <summary className="lc-tree-summary">
        <span className="lc-tree-label">{getNodeLabel(node)}</span>
        {meta.length > 0 && <span className="lc-tree-meta">{meta.join(' · ')}</span>}
        {loc && <span className="lc-tree-loc">{loc}</span>}
      </summary>
      <div className="lc-tree-children">
        {children.map(([keyLabel, childNode], index) => (
          <div className="lc-tree-branch" key={`${keyLabel}-${childNode.type ?? 'n'}-${index}`}>
            <span className="lc-tree-key">{keyLabel}</span>
            <TreeNode node={childNode} expandAll={expandAll} depth={depth + 1} />
          </div>
        ))}
      </div>
    </details>
  );
}

export default function TreeView({ tree, expandAll = false, revision = 0 }) {
  if (!isNode(tree)) return null;

  return (
    <div className="lc-tree-root" key={revision}>
      <TreeNode node={tree} expandAll={expandAll} depth={0} />
    </div>
  );
}
