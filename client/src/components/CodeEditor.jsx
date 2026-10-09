import { useEffect, useRef, useState } from 'react';

const TOKEN_PATTERN = /(\/\/[^\r\n]*|\b(?:let|print|if|else|while)\b|\b\d+(?:\.\d+)?\b|>=|<=|==|!=|[+\-*\/=<>(){};])/g;
const KEYWORDS = new Set(['let', 'print', 'if', 'else', 'while']);
const OPERATORS = new Set(['+', '-', '*', '/', '=', '>', '<', '>=', '<=', '==', '!=', '(', ')', '{', '}', ';']);

function renderHighlightedTokens(source) {
  const parts = String(source ?? '').split(TOKEN_PATTERN);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith('//')) {
      return <span className="tok-comment" key={index}>{part}</span>;
    }
    if (KEYWORDS.has(part)) {
      return <span className="tok-keyword" key={index}>{part}</span>;
    }
    if (/^\d/.test(part)) {
      return <span className="tok-number" key={index}>{part}</span>;
    }
    if (OPERATORS.has(part)) {
      return <span className="tok-operator" key={index}>{part}</span>;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(part)) {
      return <span className="tok-identifier" key={index}>{part}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function CodeEditor({
  source,
  onChange,
  onCompile,
  errorLines = [],
  fontSize = 13,
}) {
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);
  const gutterRef = useRef(null);
  const [activeLine, setActiveLine] = useState(1);
  const [focused, setFocused] = useState(false);
  const lines = String(source ?? '').split(/\r\n|\r|\n/);
  const lineHeight = Math.round(fontSize * 1.5);

  const syncScroll = (editor) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = editor.scrollTop;
      highlightRef.current.scrollLeft = editor.scrollLeft;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = editor.scrollTop;
    }
  };

  const updateActiveLine = (editor) => {
    const cursor = editor.selectionStart;
    const currentLineNumber = editor.value.slice(0, cursor).split(/\r\n|\r|\n/).length;
    setActiveLine(currentLineNumber);
  };

  useEffect(() => {
    if (textareaRef.current) {
      syncScroll(textareaRef.current);
    }
  }, [source]);

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onCompile?.();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const editor = textareaRef.current;
      if (!editor) return;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const indent = '    ';
      const nextSource = `${source.slice(0, start)}${indent}${source.slice(end)}`;
      onChange(nextSource);
      requestAnimationFrame(() => {
        editor.selectionStart = start + indent.length;
        editor.selectionEnd = start + indent.length;
      });
    }
  };

  return (
    <div
      className={`lc-editor ${focused ? 'lc-editor--focus' : ''}`}
      style={{
        '--editor-fs': `${fontSize}px`,
        '--editor-lh': `${lineHeight}px`,
      }}
    >
      <div className="lc-editor-gutter" ref={gutterRef} aria-hidden="true">
        {lines.map((_, index) => {
          const lineNumber = index + 1;
          const isActive = lineNumber === activeLine;
          const isError = errorLines.includes(lineNumber);
          return (
            <div
              key={index}
              className={`lc-gutter-line ${isActive ? 'is-active' : ''} ${isError ? 'is-error' : ''}`}
            >
              {lineNumber}
            </div>
          );
        })}
      </div>

      <div className="lc-editor-container">
        <div
          className="lc-current-line-highlight"
          style={{ top: `${(activeLine - 1) * lineHeight}px`, height: `${lineHeight}px` }}
          aria-hidden="true"
        />
        <pre
          ref={highlightRef}
          className="lc-editor-highlight"
          aria-hidden="true"
        >
          {renderHighlightedTokens(source)}
          {source.endsWith('\n') ? '\n' : ''}
        </pre>
        <textarea
          ref={textareaRef}
          className="lc-editor-input"
          aria-label="MiniLang source code"
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onClick={(event) => updateActiveLine(event.currentTarget)}
          onKeyUp={(event) => updateActiveLine(event.currentTarget)}
          onSelect={(event) => updateActiveLine(event.currentTarget)}
          onScroll={(event) => syncScroll(event.currentTarget)}
        />
      </div>
    </div>
  );
}
