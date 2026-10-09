class Scope {
  constructor(name, parent = null) {
    this.name = name;
    this.parent = parent;
    this.symbols = new Map();
  }
}

export class SymbolTable {
  constructor() {
    this.globalScope = new Scope('global');
    this.scopeStack = [this.globalScope];
    this.records = [];
    this.nextBlockId = 1;
  }

  get currentScope() {
    return this.scopeStack.at(-1);
  }

  enterBlock() {
    const scope = new Scope(`block-${this.nextBlockId}`, this.currentScope);
    this.nextBlockId += 1;
    this.scopeStack.push(scope);
    return scope.name;
  }

  exitBlock() {
    if (this.scopeStack.length === 1) {
      throw new Error('Cannot exit the global symbol scope');
    }
    this.scopeStack.pop();
  }

  hasInCurrentScope(name) {
    return this.currentScope.symbols.has(name);
  }

  declare(symbol) {
    if (this.hasInCurrentScope(symbol.name)) return false;
    this.currentScope.symbols.set(symbol.name, symbol);
    this.records.push(symbol);
    return true;
  }

  resolve(name) {
    let scope = this.currentScope;
    while (scope) {
      if (scope.symbols.has(name)) return scope.symbols.get(name);
      scope = scope.parent;
    }
    return null;
  }

  toJSON() {
    return this.records;
  }
}