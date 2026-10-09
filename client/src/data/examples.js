export const DEFAULT_SOURCE = `let a = 10;
let b = 20;
let c = a + b * 2;
print c;
`;

export const examples = [
  {
    id: '01',
    name: 'Hello / Print',
    category: 'examples',
    source: 'print 42;\n',
  },
  {
    id: '02',
    name: 'Variables',
    category: 'examples',
    source: 'let count = 7;\nlet price = 12.5;\nprint count;\nprint price;\n',
  },
  {
    id: '03',
    name: 'Arithmetic',
    category: 'examples',
    source: DEFAULT_SOURCE,
  },
  {
    id: '04',
    name: 'If / Else',
    category: 'examples',
    source: 'let score = 25.5;\nif (score >= 20) {\n    print score;\n} else {\n    print 0;\n}\n',
  },
  {
    id: '05',
    name: 'While',
    category: 'examples',
    source: 'let x = 0;\nwhile (x < 5) {\n    x = x + 1;\n}\nprint x;\n',
  },
  {
    id: '06',
    name: 'Nested Control Flow',
    category: 'examples',
    source: 'let x = 0;\nwhile (x < 10) {\n    if (x > 5) {\n        print x;\n    } else {\n        print 0;\n    }\n    x = x + 1;\n}\n',
  },
  {
    id: '07',
    name: 'Nested Expressions',
    category: 'examples',
    source: 'let a = 10;\nlet b = 20.5;\nlet result = (a + b) * (2 + 3);\nprint result;\n',
  },
  {
    id: '08',
    name: 'Lexical Error',
    category: 'errors',
    source: 'let total = 10 @ 5;\n',
  },
  {
    id: '09',
    name: 'Syntax Error',
    category: 'errors',
    source: 'let x = ;\n',
  },
  {
    id: '10',
    name: 'Undeclared Variable',
    category: 'errors',
    source: 'print unknown;\n',
  },
  {
    id: '11',
    name: 'Duplicate Declaration',
    category: 'errors',
    source: 'let x = 1;\nlet x = 2;\n',
  },
];
