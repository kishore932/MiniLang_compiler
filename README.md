# MiniLang Compiler

JavaScript-only full-stack MiniLang educational compiler. The current implementation runs lexical analysis, syntax parsing, semantic analysis, and Three Address Code generation. It returns tokens, a source-located/type-annotated AST, a scoped symbol table, diagnostics, and structured TAC. Optimization and target-code generation are not implemented yet.

## Requirements

- Node.js 20 or newer
- npm

## Install dependencies

From the project root:

```sh
npm install
```

## Start the frontend

```sh
npm run dev:client
```

Open the URL printed by Vite, normally `http://127.0.0.1:5173`.

## Start the backend

In a separate terminal at the project root:

```sh
npm run dev:server
```

The backend listens on `http://127.0.0.1:3001`. It provides `GET /api/health` and `POST /api/compile`.

To run both services together, use `npm run dev` from the root.

Run the lexer, parser, API, and pipeline integration tests with `npm test --workspace server`.

## Frontend/backend communication

During development, Vite proxies requests under `/api` to the Express server. The frontend uses `GET /api/health` for backend connectivity and sends `{ "source": "..." }` to `POST /api/compile`. The response includes `tokens`, `ast`, `symbolTable`, `semanticErrors`, `warnings`, `intermediateCode`, aggregate `errors`, phase availability flags, and measured `compilationTimeMs`. TAC generation runs only when lexing, parsing, and semantic analysis succeed. The compiler currently stops after TAC; optimization and target-code tabs report that they are the next phase.

## Planned compiler modules

Compiler logic lives under `server/src/compiler/`, coordinated by `compile.js`:

- `lexer.js`: source-to-token conversion
- `parser.js`: syntax validation and source-located AST construction
- `semanticAnalyzer.js`: declaration, scope, and type checks
- `symbolTable.js`: nested lexical scope and structured symbol records
- `intermediateCodeGenerator.js`: AST-based structured three-address code generation and formatting
- `optimizer.js`: semantics-preserving code optimizations
- `targetCodeGenerator.js`: target/pseudo-assembly generation
- `errors.js`: structured diagnostics and source locations

The implemented pipeline is lexer → parser/AST → semantic analyzer/symbol table → TAC and stops there. Later phases are planned as optimizer → target code generation. Compiler modules are independent of the Express route and React UI so phases can be tested directly.

The frontend phase views will live under `client/src/components/`; source examples will live under `client/src/data/` and contain source programs only, never generated results.