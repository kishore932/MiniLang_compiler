function nodeLabel(node) {
  if (node.type === 'Identifier') return `${node.type}: ${node.name}`;
  if (node.type === 'NumberLiteral') return `${node.type}: ${node.value} (${node.numericType})`;
  if (node.type === 'BinaryExpression' || node.type === 'UnaryExpression') {
    return `${node.type}: ${node.operator}`;
  }
  return node.type;
}

function AstNode({ node, depth = 0, expandAll = false }) {
  const scalarProperties = Object.entries(node).filter(([key, value]) => (
    !['type', 'line', 'column', 'nameLine', 'nameColumn', 'operator', 'operatorType', 'numericType'].includes(key)
    && !(node.type === 'Identifier' && key === 'name')
    && !(node.type === 'NumberLiteral' && key === 'value')
    && (value === null || ['string', 'number', 'boolean'].includes(typeof value))
  ));
  const childProperties = Object.entries(node).filter(([key, value]) => (
    !['type', 'line', 'column', 'nameLine', 'nameColumn', 'operator', 'operatorType', 'numericType'].includes(key)
    && value !== null
    && typeof value === 'object'
  ));

  return (
    <details className={`ast-node ast-node--depth-${depth % 4}`} open={expandAll || depth === 0}>
      <summary>
        <span className="ast-node-dot" aria-hidden="true" />
        <span className="ast-node-copy"><span className="ast-node-type">{nodeLabel(node)}</span><small>{node.type}</small></span>
        <span className="ast-location">{node.line}:{node.column}</span>
      </summary>
      <div className="ast-children">
        {scalarProperties.map(([key, value]) => (
          <div className="ast-property" key={key}>
            <span>{key}:</span> {String(value)}
          </div>
        ))}
        {childProperties.map(([key, value]) => (
          <div className="ast-field" key={key}>
            <span className="ast-field-name">{key}</span>
            {Array.isArray(value)
              ? value.map((child, index) => (
                <AstNode key={`${child.type}-${child.line}-${child.column}-${index}`} node={child} depth={depth + 1} expandAll={expandAll} />
              ))
              : <AstNode node={value} depth={depth + 1} expandAll={expandAll} />}
          </div>
        ))}
      </div>
    </details>
  );
}

export default function AstTree({ ast, expandAll = false }) {
  if (!ast || typeof ast !== 'object' || typeof ast.type !== 'string') return null;
  return <div className="ast-tree"><AstNode node={ast} expandAll={expandAll} /></div>;
}