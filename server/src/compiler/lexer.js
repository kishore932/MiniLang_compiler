const KEYWORDS = new Map([
  ['let', 'KEYWORD_LET'],
  ['print', 'KEYWORD_PRINT'],
  ['if', 'KEYWORD_IF'],
  ['else', 'KEYWORD_ELSE'],
  ['while', 'KEYWORD_WHILE'],
]);

const TWO_CHARACTER_OPERATORS = new Map([
  ['>=', 'GREATER_EQUAL'],
  ['<=', 'LESS_EQUAL'],
  ['==', 'EQUAL_EQUAL'],
  ['!=', 'NOT_EQUAL'],
]);

const SINGLE_CHARACTER_TOKENS = new Map([
  ['+', 'PLUS'],
  ['-', 'MINUS'],
  ['*', 'MULTIPLY'],
  ['/', 'DIVIDE'],
  ['=', 'ASSIGN'],
  ['>', 'GREATER_THAN'],
  ['<', 'LESS_THAN'],
  ['(', 'LPAREN'],
  [')', 'RPAREN'],
  ['{', 'LBRACE'],
  ['}', 'RBRACE'],
  [';', 'SEMICOLON'],
]);

const isDigit = (character) => character >= '0' && character <= '9';
const isIdentifierStart = (character) => /[A-Za-z_]/.test(character ?? '');
const isIdentifierPart = (character) => /[A-Za-z0-9_]/.test(character ?? '');

export function tokenize(source) {
  if (typeof source !== 'string') {
    throw new TypeError('Lexer source must be a string');
  }

  const tokens = [];
  const errors = [];
  let index = 0;
  let line = 1;
  let column = 1;

  const peek = (offset = 0) => source[index + offset];

  const advance = () => {
    const character = source[index];
    index += 1;

    if (character === '\r') {
      if (source[index] === '\n') index += 1;
      line += 1;
      column = 1;
    } else if (character === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }

    return character;
  };

  const addToken = (type, value, tokenLine, tokenColumn, extra = {}) => {
    tokens.push({ type, value, line: tokenLine, column: tokenColumn, ...extra });
  };

  const addError = (message, errorLine, errorColumn) => {
    errors.push({
      phase: 'lexical',
      type: 'LEXICAL_ERROR',
      message,
      line: errorLine,
      column: errorColumn,
    });
  };

  while (index < source.length) {
    const character = peek();

    if (character === ' ' || character === '\t' || character === '\r' || character === '\n') {
      advance();
      continue;
    }

    // Consume comments before treating '/' as the division operator.
    if (character === '/' && peek(1) === '/') {
      while (index < source.length && peek() !== '\r' && peek() !== '\n') advance();
      continue;
    }

    const tokenLine = line;
    const tokenColumn = column;

    if (isIdentifierStart(character)) {
      const start = index;
      advance();
      while (isIdentifierPart(peek())) advance();
      const value = source.slice(start, index);
      addToken(KEYWORDS.get(value) ?? 'IDENTIFIER', value, tokenLine, tokenColumn);
      continue;
    }

    if (isDigit(character)) {
      const start = index;
      while (isDigit(peek())) advance();

      let numericType = 'int';
      let malformed = false;
      if (peek() === '.') {
        advance();
        if (isDigit(peek())) {
          numericType = 'float';
          while (isDigit(peek())) advance();
        } else {
          malformed = true;
        }

        if (peek() === '.') malformed = true;
      }

      if (malformed) {
        // Consume the rest of a malformed digits-and-dots sequence as one diagnostic.
        while (isDigit(peek()) || peek() === '.') advance();
        const value = source.slice(start, index);
        addError(`Malformed number '${value}'`, tokenLine, tokenColumn);
        continue;
      }

      const value = source.slice(start, index);
      addToken('NUMBER', value, tokenLine, tokenColumn, { numericType });
      continue;
    }

    const operator = `${character}${peek(1) ?? ''}`;
    const twoCharacterType = TWO_CHARACTER_OPERATORS.get(operator);
    if (twoCharacterType) {
      advance();
      advance();
      addToken(twoCharacterType, operator, tokenLine, tokenColumn);
      continue;
    }

    const singleCharacterType = SINGLE_CHARACTER_TOKENS.get(character);
    if (singleCharacterType) {
      advance();
      addToken(singleCharacterType, character, tokenLine, tokenColumn);
      continue;
    }

    advance();
    addError(`Unexpected character '${character}'`, tokenLine, tokenColumn);
  }

  return { tokens, errors };
}