import React from 'react';

export default function SyntaxTreeViewer({ syntaxTree, expandAll = true }) {
  if (!syntaxTree || typeof syntaxTree !== 'object') return null;

  function TreeNode({ node, depth = 0 }) {
    const children = Array.isArray(node.children) ? node.children : [];
    const hasChildren = children.length > 0;
    const label = node.value !== undefined && node.value !== null ? `${node.type}: ${node.value}` : node.type;
    const shouldOpen = expandAll || depth < 1;

    if (!hasChildren) {
      return (
        <div className="syntax-tree-leaf">
          <span className="syntax-tree-label">{label}</span>
          {node.line && node.column ? <span className="tree-meta">{node.line}:{node.column}</span> : null}
        </div>
      );
    }

    return (
      <details className="syntax-tree-node" open={shouldOpen}>
        <summary>
          <span className="tree-caret" aria-hidden="true">▾</span>
          <span className="syntax-tree-label">{label}</span>
          {node.line && node.column ? <span className="tree-meta">{node.line}:{node.column}</span> : null}
        </summary>
        <div className="syntax-tree-children">
          {children.map((child, index) => (
            <TreeNode key={`${child.type ?? 'node'}-${index}-${child.line ?? 0}-${child.column ?? 0}`} node={child} depth={depth + 1} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <div className="syntax-tree-view">
      <TreeNode node={syntaxTree} depth={0} />
    </div>
  );
}
