/*!
This file includes code from jmespath.js
Licensed under the Apache License 2.0: http://www.apache.org/licenses/LICENSE-2.0
Modified by @ceymard for IQVIA
 - made it ESNext friendlier
 - added group_by
 - can now use Unicode identifiers instead of just ASCII
 - numbers can be entered as literals
*/

function isArray(obj: unknown): obj is unknown[] {
  if (obj !== null) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  } else {
    return false;
  }
}

function isObject(obj: unknown): obj is Record<string, unknown> {
  if (obj !== null) {
    return Object.prototype.toString.call(obj) === "[object Object]";
  } else {
    return false;
  }
}

export function strictDeepEqual(first: unknown, second: any): boolean {
  // Check the scalar case first.
  if (first === second) {
    return true;
  }

  // Check if they are the same type. This is why second is any.
  var firstType = Object.prototype.toString.call(first);
  if (firstType !== Object.prototype.toString.call(second)) {
    return false;
  }
  // We know that first and second have the same type so we can just check the
  // first type from now on.
  if (isArray(first) === true) {
    // Short circuit if they're not the same length;
    if (first.length !== second.length) {
      return false;
    }
    for (var i = 0; i < first.length; i++) {
      if (strictDeepEqual(first[i], second[i]) === false) {
        return false;
      }
    }
    return true;
  }
  if (isObject(first) === true) {
    // An object is equal if it has the same key/value pairs.
    var keysSeen: Record<string, boolean> = {};
    for (var key in first) {
      if (Object.prototype.hasOwnProperty.call(first, key)) {
        if (strictDeepEqual(first[key], second[key]) === false) {
          return false;
        }
        keysSeen[key] = true;
      }
    }
    // Now check that there aren't any keys in second that weren't
    // in first.
    for (var key2 in second) {
      if (Object.prototype.hasOwnProperty.call(second, key2)) {
        if (keysSeen[key2] !== true) {
          return false;
        }
      }
    }
    return true;
  }
  return false;
}

function isFalsy(obj: unknown): boolean {
  // From the spec:
  // A false value corresponds to the following values:
  // Empty list
  // Empty object
  // Empty string
  // False boolean
  // null value

  // First check the scalar values.
  if (obj === "" || obj === false || obj === null) {
    return true;
  } else if (isArray(obj) && obj.length === 0) {
    // Check for an empty array.
    return true;
  } else if (isObject(obj)) {
    // Check for an empty object.
    for (var key in obj) {
      // If there are any keys, then
      // the object is not empty so the object
      // is not false.
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
}

function objValues(obj: Record<string, unknown>): unknown[] {
  var keys = Object.keys(obj);
  var values = [];
  for (var i = 0; i < keys.length; i++) {
    values.push(obj[keys[i]]);
  }
  return values;
}


// // Type constants used to define functions.
// const enum TYPE {
//   NUMBER = "number",
//   ANY = "any",
//   STRING = "string",
//   ARRAY = "array",
//   OBJECT = "object",
//   BOOLEAN = "boolean",
//   EXPREF = "expression",
// }

export const enum Type {
  NUMBER = 0,
  ANY = 1,
  STRING = 2,
  ARRAY = 3,
  OBJECT = 4,
  BOOLEAN = 5,
  EXPREF = 6,
  NULL = 7,
  ARRAY_NUMBER = 8,
  ARRAY_STRING = 9,
}

const TYPE_NAME_TABLE: Record<Type, string> = {
  [Type.NUMBER]: 'number',
  [Type.ANY]: 'any',
  [Type.STRING]: 'string',
  [Type.ARRAY]: 'array',
  [Type.OBJECT]: 'object',
  [Type.BOOLEAN]: 'boolean',
  [Type.EXPREF]: 'expression',
  [Type.NULL]: 'null',
  [Type.ARRAY_NUMBER]: 'Array<number>',
  [Type.ARRAY_STRING]: 'Array<string>'
};

export function getTypeName(type: Type): string {
  return TYPE_NAME_TABLE[type];
}

export const enum TOK {
  EOF,
  UNQUOTEDIDENTIFIER,
  QUOTEDIDENTIFIER,
  RBRACKET,
  RPAREN,
  COMMA,
  COLON,
  RBRACE,
  NUMBER,
  CURRENT,
  EXPREF,
  PIPE,
  OR,
  AND,
  EQ,
  GT,
  LT,
  GTE,
  LTE,
  NE,
  FLATTEN,
  STAR,
  FILTER,
  DOT,
  NOT,
  LBRACE,
  LBRACKET,
  LPAREN,
  LITERAL,
}

export const TOKNAME_TABLE = {
  [TOK.EOF]: "EOF",
  [TOK.UNQUOTEDIDENTIFIER]: "UnquotedIdentifier",
  [TOK.QUOTEDIDENTIFIER]: "QuotedIdentifier",
  [TOK.RBRACKET]: "Rbracket",
  [TOK.RPAREN]: "Rparen",
  [TOK.COMMA]: "Comma",
  [TOK.COLON]: "Colon",
  [TOK.RBRACE]: "Rbrace",
  [TOK.NUMBER]: "Number",
  [TOK.CURRENT]: "Current",
  [TOK.EXPREF]: "Expref",
  [TOK.PIPE]: "Pipe",
  [TOK.OR]: "Or",
  [TOK.AND]: "And",
  [TOK.EQ]: "EQ",
  [TOK.GT]: "GT",
  [TOK.LT]: "LT",
  [TOK.GTE]: "GTE",
  [TOK.LTE]: "LTE",
  [TOK.NE]: "NE",
  [TOK.FLATTEN]: "Flatten",
  [TOK.STAR]: "Star",
  [TOK.FILTER]: "Filter",
  [TOK.DOT]: "Dot",
  [TOK.NOT]: "Not",
  [TOK.LBRACE]: "Lbrace",
  [TOK.LBRACKET]: "Lbracket",
  [TOK.LPAREN]: "Lparen",
  [TOK.LITERAL]: "Literal",
}

export function getTokName(tok: TOK): string {
  return TOKNAME_TABLE[tok];
}


type Token = {
  type: TOK;
  value: string;
  start: number;
} | {
  type: TOK.NUMBER;
  value: number;
  start: number;
} | {
  type: TOK.LITERAL;
  value: unknown;
  start: number;
}

// The "&", "[", "<", ">" tokens
// are not in basicToken because
// there are two token variants
// ("&&", "[?", "<=", ">=").  This is specially handled
// below.

const basicTokens: Record<string, TOK> = {
  ".": TOK.DOT,
  "*": TOK.STAR,
  ",": TOK.COMMA,
  ":": TOK.COLON,
  "{": TOK.LBRACE,
  "}": TOK.RBRACE,
  "]": TOK.RBRACKET,
  "(": TOK.LPAREN,
  ")": TOK.RPAREN,
  "@": TOK.CURRENT
};

const operatorStartToken: Record<string, boolean> = {
  "<": true,
  ">": true,
  "=": true,
  "!": true
};

const skipChars: Record<string, boolean> = {
  " ": true,
  "\t": true,
  "\n": true
};


// Matches Unicode letters, Unicode combining marks, and underscore
// This is what JS engines use for identifier starts
function isIdentifierStart(ch: string): boolean {
  return /^[\p{L}\p{Nl}_$]$/u.test(ch);
}

// Identifier continuation also allows digits and Unicode combining/connector marks
function isIdentifierPart(ch: string): boolean {
  return /^[\p{L}\p{Nl}\p{Nd}\p{Mn}\p{Mc}\p{Pc}_$]$/u.test(ch);
}

function isNum(ch: string): boolean {
  return (ch >= "0" && ch <= "9") ||
    ch === "-";
}

class Lexer {
  private _current: number = 0;

  tokenize(stream: string): Token[] {
    var tokens: Token[] = [];
    // this._current = 0;
    var start: number;
    var identifier: string;
    var token: Token;
    while (this._current < stream.length) {
      const c = stream[this._current];
      if (isIdentifierStart(c)) {
        start = this._current;
        identifier = this._consumeUnquotedIdentifier(stream);
        tokens.push({
          type: TOK.UNQUOTEDIDENTIFIER,
          value: identifier,
          start: start
        });
      } else if (basicTokens[c] !== undefined) {
        tokens.push({
          type: basicTokens[stream[this._current]],
          value: c,
          start: this._current
        });
        this._current++;
      } else if (isNum(c)) {
        token = this._consumeNumber(stream);
        tokens.push(token);
      } else if (c === "[") {
        // No need to increment this._current.  This happens
        // in _consumeLBracket
        token = this._consumeLBracket(stream);
        tokens.push(token);
      } else if (c === "\"") {
        start = this._current;
        identifier = this._consumeQuotedIdentifier(stream);
        tokens.push({
          type: TOK.QUOTEDIDENTIFIER,
          value: identifier,
          start: start
        });
      } else if (c === "'") {
        start = this._current;
        identifier = this._consumeRawStringLiteral(stream);
        tokens.push({
          type: TOK.LITERAL,
          value: identifier,
          start: start
        });
      } else if (c === "`") {
        start = this._current;
        var literal = this._consumeLiteral(stream);
        tokens.push({
          type: TOK.LITERAL,
          value: literal,
          start: start
        });
      } else if (operatorStartToken[c] !== undefined) {
        tokens.push(this._consumeOperator(stream));
      } else if (skipChars[c] !== undefined) {
        // Ignore whitespace.
        this._current++;
      } else if (c === "&") {
        start = this._current;
        this._current++;
        const c = stream[this._current];
        if (c === "&") {
          this._current++;
          tokens.push({ type: TOK.AND, value: "&&", start: start });
        } else {
          tokens.push({ type: TOK.EXPREF, value: "&", start: start });
        }
      } else if (c === "|") {
        start = this._current;
        this._current++;
        const c = stream[this._current];
        if (c === "|") {
          this._current++;
          tokens.push({ type: TOK.OR, value: "||", start: start });
        } else {
          tokens.push({ type: TOK.PIPE, value: "|", start: start });
        }
      } else {
        var error = new Error("Unknown character:" + c);
        error.name = "LexerError";
        throw error;
      }
    }
    return tokens;
  }

  _consumeUnquotedIdentifier(stream: string): string {
    var start = this._current;
    this._current++;
    while (this._current < stream.length && isIdentifierPart(stream[this._current])) {
      this._current++;
    }
    return stream.slice(start, this._current);
  }

  _consumeQuotedIdentifier(stream: string): string {
    var start = this._current;
    this._current++;
    var maxLength = stream.length;
    while (stream[this._current] !== "\"" && this._current < maxLength) {
      // You can escape a double quote and you can escape an escape.
      var current = this._current;
      if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
        stream[current + 1] === "\"")) {
        current += 2;
      } else {
        current++;
      }
      this._current = current;
    }
    this._current++;
    return JSON.parse(stream.slice(start, this._current));
  }

  _consumeRawStringLiteral(stream: string): string {
    var start = this._current;
    this._current++;
    var maxLength = stream.length;
    while (stream[this._current] !== "'" && this._current < maxLength) {
      // You can escape a single quote and you can escape an escape.
      var current = this._current;
      if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
        stream[current + 1] === "'")) {
        current += 2;
      } else {
        current++;
      }
      this._current = current;
    }
    this._current++;
    var literal = stream.slice(start + 1, this._current - 1);
    return literal.replace("\\'", "'");
  }

  _consumeNumber(stream: string): Token {
    var start = this._current;
    this._current++;
    var maxLength = stream.length;
    while (isNum(stream[this._current]) && this._current < maxLength) {
      this._current++;
    }
    var value = parseInt(stream.slice(start, this._current));
    return { type: TOK.NUMBER, value: value, start: start };
  }

  _consumeLBracket(stream: string): Token {
    var start = this._current;
    this._current++;
    if (stream[this._current] === "?") {
      this._current++;
      return { type: TOK.FILTER, value: "[?", start: start };
    } else if (stream[this._current] === "]") {
      this._current++;
      return { type: TOK.FLATTEN, value: "[]", start: start };
    } else {
      return { type: TOK.LBRACKET, value: "[", start: start };
    }
  }

  _consumeOperator(stream: string): Token {
    var start = this._current;
    var startingChar = stream[start];
    this._current++;
    if (startingChar === "!") {
      if (stream[this._current] === "=") {
        this._current++;
        return { type: TOK.NE, value: "!=", start: start };
      } else {
        return { type: TOK.NOT, value: "!", start: start };
      }
    } else if (startingChar === "<") {
      if (stream[this._current] === "=") {
        this._current++;
        return { type: TOK.LTE, value: "<=", start: start };
      } else {
        return { type: TOK.LT, value: "<", start: start };
      }
    } else if (startingChar === ">") {
      if (stream[this._current] === "=") {
        this._current++;
        return { type: TOK.GTE, value: ">=", start: start };
      } else {
        return { type: TOK.GT, value: ">", start: start };
      }
    } else if (startingChar === "=") {
      if (stream[this._current] === "=") {
        this._current++;
        return { type: TOK.EQ, value: "==", start: start };
      }
    }
    var error = new Error("Unknown operator:" + startingChar);
    error.name = "ParserError";
    throw error;
  }

  _consumeLiteral(stream: string): unknown {
    this._current++;
    var start = this._current;
    var maxLength = stream.length;
    var literal;
    while (stream[this._current] !== "`" && this._current < maxLength) {
      // You can escape a literal char or you can escape the escape.
      var current = this._current;
      if (stream[current] === "\\" && (stream[current + 1] === "\\" ||
        stream[current + 1] === "`")) {
        current += 2;
      } else {
        current++;
      }
      this._current = current;
    }
    var literalString = stream.slice(start, this._current).trimLeft();
    literalString = literalString.replace("\\`", "`");
    if (this._looksLikeJSON(literalString)) {
      literal = JSON.parse(literalString);
    } else {
      // Try to JSON parse it as "<literal>"
      literal = JSON.parse("\"" + literalString + "\"");
    }
    // +1 gets us to the ending "`", +1 to move on to the next char.
    this._current++;
    return literal;
  }

  _looksLikeJSON(literalString: string): boolean {
    var startingChars = "[{\"";
    var jsonLiterals = ["true", "false", "null"];
    var numberLooking = "-0123456789";

    if (literalString === "") {
      return false;
    } else if (startingChars.indexOf(literalString[0]) >= 0) {
      return true;
    } else if (jsonLiterals.indexOf(literalString) >= 0) {
      return true;
    } else if (numberLooking.indexOf(literalString[0]) >= 0) {
      try {
        JSON.parse(literalString);
        return true;
      } catch (ex) {
        return false;
      }
    } else {
      return false;
    }

  }
}

const bindingPower: Record<TOK, number> = {
  [TOK.EOF]: 0,
  [TOK.UNQUOTEDIDENTIFIER]: 0,
  [TOK.QUOTEDIDENTIFIER]: 0,
  [TOK.RBRACKET]: 0,
  [TOK.RPAREN]: 0,
  [TOK.COMMA]: 0,
  [TOK.RBRACE]: 0,
  [TOK.NUMBER]: 0,
  [TOK.CURRENT]: 0,
  [TOK.EXPREF]: 0,
  [TOK.PIPE]: 1,
  [TOK.OR]: 2,
  [TOK.AND]: 3,
  [TOK.EQ]: 5,
  [TOK.GT]: 5,
  [TOK.LT]: 5,
  [TOK.GTE]: 5,
  [TOK.LTE]: 5,
  [TOK.NE]: 5,
  [TOK.FLATTEN]: 9,
  [TOK.STAR]: 20,
  [TOK.FILTER]: 21,
  [TOK.DOT]: 40,
  [TOK.NOT]: 45,
  [TOK.LBRACE]: 50,
  [TOK.LBRACKET]: 55,
  [TOK.LPAREN]: 60,

  [TOK.LITERAL]: 999999,
  [TOK.COLON]: 999999,
};

const enum Node {
  Invalid,
  Comparator,
  Literal,
  Field,
  NotExpression,
  Identity,
  ValueProjection,
  FilterProjection,
  Projection,
  Index,
  IndexExpression,
  Subexpression,
  OrExpression,
  AndExpression,
  Function,
  KeyValuePair,
  MultiSelectHash,
  MultiSelectList,
  Flatten,
  Slice,
  Current,
  ExpressionReference,
  Pipe,
}

const NODE_NAME_TABLE: Record<Node, string> = {
  [Node.Literal]: "Literal",
  [Node.Field]: "Field",
  [Node.NotExpression]: "NotExpression",
  [Node.Identity]: "Identity",
  [Node.ValueProjection]: "ValueProjection",
  [Node.FilterProjection]: "FilterProjection",
  [Node.Projection]: "Projection",
  [Node.Index]: "Index",
  [Node.IndexExpression]: "IndexExpression",
  [Node.Subexpression]: "Subexpression",
  [Node.OrExpression]: "OrExpression",
  [Node.AndExpression]: "AndExpression",
  [Node.Function]: "Function",
  [Node.Invalid]: "Invalid",
  [Node.KeyValuePair]: "KeyValuePair",
  [Node.MultiSelectHash]: "MultiSelectHash",
  [Node.MultiSelectList]: "MultiSelectList",
  [Node.Flatten]: "Flatten",
  [Node.Slice]: "Slice",
  [Node.Comparator]: "Comparator",
  [Node.Current]: "Current",
  [Node.ExpressionReference]: "ExpressionReference",
  [Node.Pipe]: "Pipe",
}

function getNodeName(node: Node): string {
  return NODE_NAME_TABLE[node];
}

type KeyValuePair = { type: Node.KeyValuePair, name: string, value: Exp };

type Exp =
  | { type: Node.Literal, value: unknown }
  | { type: Node.Field, name: string }
  | { type: Node.NotExpression, children: Exp[] }
  | { type: Node.Identity }
  | { type: Node.ValueProjection, children: [Exp, Exp] }
  | { type: Node.FilterProjection, children: [Exp, Exp, Exp] }
  | { type: Node.Projection, children: [Exp, Exp] }
  | { type: Node.Index, value: number }
  | { type: Node.IndexExpression, children: [Exp, Exp] }
  | { type: Node.Subexpression, children: [Exp, Exp] }
  | { type: Node.OrExpression, children: [Exp, Exp] }
  | { type: Node.AndExpression, children: [Exp, Exp] }
  | { type: Node.Function, name: string, children: Exp[] }
  | KeyValuePair
  | { type: Node.MultiSelectHash, children: KeyValuePair[] }
  | { type: Node.MultiSelectList, children: Exp[] }
  | { type: Node.Flatten, children: [Exp] }
  | { type: Node.Slice, children: [number | null, number | null, number | null] }
  | { type: Node.Current }
  | { type: Node.Comparator, name: TOK, children: [Exp, Exp] }
  | { type: Node.ExpressionReference, children: [Exp] }
  | { type: Node.Pipe, children: [Exp, Exp] }

export class Parser {

  private index: number = 0;
  private tokens: Token[] = [];

  parse(expression: string): Exp {
    this._loadTokens(expression);
    this.index = 0;
    var ast = this.expression(0);
    if (this._lookahead(0) !== TOK.EOF) {
      var t = this._lookaheadToken(0);
      var error = new Error(
        "Unexpected token type: " + t.type + ", value: " + t.value);
      error.name = "ParserError";
      throw error;
    }
    return ast;
  }

  _loadTokens(expression: string): void {
    var lexer = new Lexer();
    var tokens = lexer.tokenize(expression);
    tokens.push({ type: TOK.EOF, value: "", start: expression.length });
    this.tokens = tokens;
  }

  expression(rbp: number): Exp {
    var leftToken = this._lookaheadToken(0);
    this._advance();
    var left = this.nud(leftToken);
    var currentToken = this._lookahead(0);
    while (rbp < bindingPower[currentToken]) {
      this._advance();
      left = this.led(currentToken, left);
      currentToken = this._lookahead(0);
    }
    return left;
  }

  _lookahead(number: number): TOK {
    return this.tokens[this.index + number].type;
  }

  _lookaheadToken(number: number): Token {
    return this.tokens[this.index + number];
  }

  _advance() {
    this.index++;
  }

  nud(token: Token): Exp {
    let left: Exp;
    let right: Exp | null = null;
    let expression: Exp;
    switch (token.type) {
      // case TOK.NUMBER:
      case TOK.LITERAL:
        return { type: Node.Literal, value: token.value };
      case TOK.UNQUOTEDIDENTIFIER:
        return { type: Node.Field, name: token.value };
      case TOK.QUOTEDIDENTIFIER:
        var node: Exp = { type: Node.Field, name: token.value };
        if (this._lookahead(0) === TOK.LPAREN) {
          throw new Error("Quoted identifier not allowed for function names.");
        }
        return node;
      case TOK.NOT:
        right = this.expression(bindingPower[TOK.NOT]);
        return { type: Node.NotExpression, children: [right] };
      case TOK.STAR:
        left = { type: Node.Identity };
        right = null;
        if (this._lookahead(0) === TOK.RBRACKET) {
          // This can happen in a multiselect,
          // [a, b, *]
          right = { type: Node.Identity };
        } else {
          right = this._parseProjectionRHS(bindingPower[TOK.STAR]);
        }
        return { type: Node.ValueProjection, children: [left, right] };
      case TOK.FILTER:
        return this.led(token.type, { type: Node.Identity });
      case TOK.LBRACE:
        return this._parseMultiselectHash();
      case TOK.FLATTEN:
        left = { type: Node.Flatten, children: [{ type: Node.Identity }] };
        right = this._parseProjectionRHS(bindingPower[TOK.FLATTEN]);
        return { type: Node.Projection, children: [left, right] };
      case TOK.LBRACKET:
        if (this._lookahead(0) === TOK.NUMBER || this._lookahead(0) === TOK.COLON) {
          right = this._parseIndexExpression();
          return this._projectIfSlice({ type: Node.Identity }, right);
        } else if (this._lookahead(0) === TOK.STAR &&
          this._lookahead(1) === TOK.RBRACKET) {
          this._advance();
          this._advance();
          right = this._parseProjectionRHS(bindingPower[TOK.STAR]);
          return {
            type: Node.Projection,
            children: [{ type: Node.Identity }, right]
          };
        }
        return this._parseMultiselectList();
      case TOK.CURRENT:
        return { type: Node.Current };
      case TOK.EXPREF:
        expression = this.expression(bindingPower[TOK.EXPREF]);
        return { type: Node.ExpressionReference, children: [expression] };
      case TOK.LPAREN:
        var args: Exp[] = [];
        while (this._lookahead(0) !== TOK.RPAREN) {
          if (this._lookahead(0) === TOK.CURRENT) {
            expression = { type: Node.Current };
            this._advance();
          } else {
            expression = this.expression(0);
          }
          args.push(expression);
        }
        this._match(TOK.RPAREN);
        return args[0];
      default:
        this._errorToken(token);
    }
  }

  led(tokenType: TOK, left: Exp): Exp {
    let right: Exp | null = null;
    switch (tokenType) {
      case TOK.DOT:
        var rbp = bindingPower[TOK.DOT];
        if (this._lookahead(0) !== TOK.STAR) {
          right = this._parseDotRHS(rbp);
          return { type: Node.Subexpression, children: [left, right] };
        }
        // Creating a projection.
        this._advance();
        right = this._parseProjectionRHS(rbp);
        return { type: Node.ValueProjection, children: [left, right] };
      case TOK.PIPE:
        right = this.expression(bindingPower[TOK.PIPE]);
        return { type: Node.OrExpression, children: [left, right] };
      case TOK.OR:
        right = this.expression(bindingPower[TOK.OR]);
        return { type: Node.OrExpression, children: [left, right] };
      case TOK.AND:
        right = this.expression(bindingPower[TOK.AND]);
        return { type: Node.AndExpression, children: [left, right] };
      case TOK.LPAREN:
        var name = left.name;
        var args = [];
        var expression, node;
        while (this._lookahead(0) !== TOK.RPAREN) {
          if (this._lookahead(0) === TOK.CURRENT) {
            expression = { type: TOK.CURRENT };
            this._advance();
          } else {
            expression = this.expression(0);
          }
          if (this._lookahead(0) === TOK.COMMA) {
            this._match(TOK.COMMA);
          }
          args.push(expression);
        }
        this._match(TOK.RPAREN);
        node = { type: Node.Function, name: name, children: args };
        return node;
      case TOK.FILTER:
        var condition = this.expression(0);
        this._match(TOK.RBRACKET);
        if (this._lookahead(0) === TOK.FLATTEN) {
          right = { type: Node.Identity };
        } else {
          right = this._parseProjectionRHS(bindingPower[TOK.FILTER]);
        }
        return { type: Node.FilterProjection, children: [left, right, condition] };
      case TOK.FLATTEN:
        var leftNode: Exp = { type: Node.Flatten, children: [left] };
        var rightNode = this._parseProjectionRHS(bindingPower[TOK.FLATTEN]);
        return { type: Node.Projection, children: [leftNode, rightNode] };
      case TOK.EQ:
      case TOK.NE:
      case TOK.GT:
      case TOK.GTE:
      case TOK.LT:
      case TOK.LTE:
        return this._parseComparator(left, tokenType);
      case TOK.LBRACKET:
        var token = this._lookaheadToken(0);
        if (token.type === TOK.NUMBER || token.type === TOK.COLON) {
          right = this._parseIndexExpression();
          return this._projectIfSlice(left, right);
        }
        this._match(TOK.STAR);
        this._match(TOK.RBRACKET);
        right = this._parseProjectionRHS(bindingPower[TOK.STAR]);
        return { type: Node.Projection, children: [left, right] };
      default:
        this._errorToken(this._lookaheadToken(0));
    }
  }

  _match(tokenType: TOK): void {
    if (this._lookahead(0) === tokenType) {
      this._advance();
    } else {
      var t = this._lookaheadToken(0);
      var error = new Error("Expected " + getTokName(tokenType) + ", got: " + getTokName(t.type));
      error.name = "ParserError";
      throw error;
    }
  }

  _errorToken(token: Token): never {
    var error = new Error("Invalid token (" +
      getTokName(token.type) + "): \"" +
      token.value + "\"");
    error.name = "ParserError";
    throw error;
  }


  _parseIndexExpression(): Exp {
    if (this._lookahead(0) === TOK.COLON || this._lookahead(1) === TOK.COLON) {
      return this._parseSliceExpression();
    } else {
      var node: Exp = {
        type: Node.Index,
        value: this._lookaheadToken(0).value
      };
      this._advance();
      this._match(TOK.RBRACKET);
      return node;
    }
  }

  _projectIfSlice(left: Exp, right: Exp): Exp {
    const indexExpr: Exp = { type: Node.IndexExpression, children: [left, right] };
    if (right.type === Node.Slice) {
      return {
        type: Node.Projection,
        children: [indexExpr, this._parseProjectionRHS(bindingPower[TOK.STAR])]
      };
    } else {
      return indexExpr;
    }
  }

  _parseSliceExpression(): Exp {
    // [start:end:step] where each part is optional, as well as the last
    // colon.
    var parts: [number | null, number | null, number | null] = [null, null, null];
    var index = 0;
    var currentToken = this._lookahead(0);
    while (currentToken !== TOK.RBRACKET && index < 3) {
      if (currentToken === TOK.COLON) {
        index++;
        this._advance();
      } else if (currentToken === TOK.NUMBER) {
        parts[index] = this._lookaheadToken(0).value as number;
        this._advance();
      } else {
        var t = this._lookahead(0);
        const error = new Error("Syntax error, unexpected token: " +
          getTokName(t));
        error.name = "Parsererror";
        throw error;
      }
      currentToken = this._lookahead(0);
    }
    this._match(TOK.RBRACKET);
    return {
      type: Node.Slice,
      children: parts
    };
  }

  _parseComparator(left: Exp, comparator: TOK): Exp {
    var right = this.expression(bindingPower[comparator]);
    return { type: Node.Comparator, name: comparator, children: [left, right] };
  }

  _parseDotRHS(rbp: number): Exp {
    var lookahead = this._lookahead(0);
    var exprTokens = [TOK.UNQUOTEDIDENTIFIER, TOK.QUOTEDIDENTIFIER, TOK.STAR];
    if (exprTokens.indexOf(lookahead) >= 0) {
      return this.expression(rbp);
    } else if (lookahead === TOK.LBRACKET) {
      this._match(TOK.LBRACKET);
      return this._parseMultiselectList();
    } else if (lookahead === TOK.LBRACE) {
      this._match(TOK.LBRACE);
      return this._parseMultiselectHash();
    }
    throw new Error("Syntax error, unexpected token: " + getTokName(lookahead));
  }

  _parseProjectionRHS(rbp: number): Exp {
    let right: Exp;
    if (bindingPower[this._lookahead(0)] < 10) {
      right = { type: Node.Identity };
    } else if (this._lookahead(0) === TOK.LBRACKET) {
      right = this.expression(rbp);
    } else if (this._lookahead(0) === TOK.FILTER) {
      right = this.expression(rbp);
    } else if (this._lookahead(0) === TOK.DOT) {
      this._match(TOK.DOT);
      right = this._parseDotRHS(rbp);
    } else {
      var t = this._lookaheadToken(0);
      var error = new Error("Sytanx error, unexpected token: " +
        t.value + "(" + t.type + ")");
      error.name = "ParserError";
      throw error;
    }
    return right;
  }

  _parseMultiselectList(): Exp {
    const expressions: Exp[] = [];
    while (this._lookahead(0) !== TOK.RBRACKET) {
      let expression = this.expression(0);
      expressions.push(expression);
      if (this._lookahead(0) === TOK.COMMA) {
        this._match(TOK.COMMA);
        if (this._lookahead(0) === TOK.RBRACKET) {
          throw new Error("Unexpected token Rbracket");
        }
      }
    }
    this._match(TOK.RBRACKET);
    return { type: Node.MultiSelectList, children: expressions };
  }

  _parseMultiselectHash(): Exp {
    var pairs: KeyValuePair[] = [];
    var identifierTypes = [TOK.UNQUOTEDIDENTIFIER, TOK.QUOTEDIDENTIFIER];
    let keyToken, keyName, value, node: Exp;
    for (; ;) {
      keyToken = this._lookaheadToken(0);
      if (identifierTypes.indexOf(keyToken.type) < 0) {
        throw new Error("Expecting an identifier token, got: " +
          keyToken.type);
      }
      keyName = (keyToken.value)?.toString() as string;
      this._advance();
      if (this._lookahead(0) !== TOK.COLON) {
        node = { type: Node.KeyValuePair, name: keyName, value: { type: Node.Field, name: keyName } };
        pairs.push(node);
      } else {
        this._match(TOK.COLON);
        value = this.expression(0);
        node = { type: Node.KeyValuePair, name: keyName, value: value };
        pairs.push(node);
      }
      if (this._lookahead(0) === TOK.COMMA) {
        this._match(TOK.COMMA);
      } else if (this._lookahead(0) === TOK.RBRACE) {
        this._match(TOK.RBRACE);
        break;
      }
    }
    return { type: Node.MultiSelectHash, children: pairs };

  }
}

export class TreeInterpreter {

  private runtime: Runtime;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }


  search(node: Exp, value: unknown): unknown {
    return this.visit(node, value);
  }

  visit(node: Exp, value: unknown): unknown {
    var matched, current, result, first, second, field, left, right, collected, i: number;
    switch (node.type) {
      case Node.Field:
        if (value !== null && isObject(value)) {
          field = value[node.name];
          if (field === undefined) {
            return null;
          } else {
            return field;
          }
        }
        return null;
      case Node.Subexpression:
        result = this.visit(node.children[0], value);
        for (i = 1; i < node.children.length; i++) {
          result = this.visit(node.children[1], result);
          if (result === null) {
            return null;
          }
        }
        return result;
      case Node.IndexExpression:
        left = this.visit(node.children[0], value);
        right = this.visit(node.children[1], left);
        return right;
      case Node.Index:
        if (!isArray(value)) {
          return null;
        }
        var index = node.value;
        if (index < 0) {
          index = value.length + index;
        }
        result = value[index];
        if (result === undefined) {
          result = null;
        }
        return result;
      case Node.Slice:
        if (!isArray(value)) {
          return null;
        }
        var sliceParams = node.children.slice(0) as typeof node.children;
        const [start, stop, step] = this.computeSliceParams(value.length, sliceParams);
        result = [];
        if (step > 0) {
          for (i = start; i < stop; i += step) {
            result.push(value[i]);
          }
        } else {
          for (i = start; i > stop; i += step) {
            result.push(value[i]);
          }
        }
        return result;
      case Node.Projection:
        // Evaluate left child.
        var base = this.visit(node.children[0], value);
        if (!isArray(base)) {
          return null;
        }
        collected = [];
        for (i = 0; i < base.length; i++) {
          current = this.visit(node.children[1], base[i]);
          if (current !== null) {
            collected.push(current);
          }
        }
        return collected;
      case Node.ValueProjection:
        // Evaluate left child.
        base = this.visit(node.children[0], value);
        if (!isObject(base)) {
          return null;
        }
        collected = [];
        var values = objValues(base);
        for (i = 0; i < values.length; i++) {
          current = this.visit(node.children[1], values[i]);
          if (current !== null) {
            collected.push(current);
          }
        }
        return collected;
      case Node.FilterProjection:
        base = this.visit(node.children[0], value);
        if (!isArray(base)) {
          return null;
        }
        var filtered = [];
        var finalResults = [];
        for (i = 0; i < base.length; i++) {
          matched = this.visit(node.children[2], base[i]);
          if (!isFalsy(matched)) {
            filtered.push(base[i]);
          }
        }
        for (var j = 0; j < filtered.length; j++) {
          current = this.visit(node.children[1], filtered[j]);
          if (current !== null) {
            finalResults.push(current);
          }
        }
        return finalResults;
      case Node.Comparator:
        first = this.visit(node.children[0], value);
        second = this.visit(node.children[1], value);
        switch (node.name) {
          case TOK.EQ:
            result = strictDeepEqual(first, second);
            break;
          case TOK.NE:
            result = !strictDeepEqual(first, second);
            break;
          case TOK.GT:
            result = first > second;
            break;
          case TOK.GTE:
            result = first >= second;
            break;
          case TOK.LT:
            result = first < second;
            break;
          case TOK.LTE:
            result = first <= second;
            break;
          default:
            throw new Error("Unknown comparator: " + node.name);
        }
        return result;
      case Node.Flatten:
        var original = this.visit(node.children[0], value);
        if (!isArray(original)) {
          return null;
        }
        var merged = [];
        for (i = 0; i < original.length; i++) {
          current = original[i];
          if (isArray(current)) {
            merged.push.apply(merged, current);
          } else {
            merged.push(current);
          }
        }
        return merged;
      case Node.Identity:
        return value;
      case Node.MultiSelectList:
        if (value === null) {
          return null;
        }
        collected = [];
        for (i = 0; i < node.children.length; i++) {
          collected.push(this.visit(node.children[i], value));
        }
        return collected;
      case Node.MultiSelectHash: {
        if (value === null) {
          return null;
        }
        const collected: Record<string, unknown> = {};
        for (i = 0; i < node.children.length; i++) {
          let child = node.children[i];
          collected[child.name] = this.visit(child.value, value);
        }
        return collected;
      }
      case Node.OrExpression:
        matched = this.visit(node.children[0], value);
        if (isFalsy(matched)) {
          matched = this.visit(node.children[1], value);
        }
        return matched;
      case Node.AndExpression:
        first = this.visit(node.children[0], value);

        if (isFalsy(first) === true) {
          return first;
        }
        return this.visit(node.children[1], value);
      case Node.NotExpression:
        first = this.visit(node.children[0], value);
        return isFalsy(first);
      case Node.Literal:
        return node.value;
      case Node.Pipe:
        left = this.visit(node.children[0], value);
        return this.visit(node.children[1], left);
      case Node.Current:
        return value;
      case Node.Function:
        var resolvedArgs = [];
        for (i = 0; i < node.children.length; i++) {
          resolvedArgs.push(this.visit(node.children[i], value));
        }
        return this.runtime.callFunction(node.name, resolvedArgs);
      case Node.ExpressionReference:
        var refNode = node.children[0];
        // Tag the node with a specific attribute so the type
        // checker verify the type.
        refNode.jmespathType = TOK.EXPREF;
        return refNode;
      default:
        throw new Error("Unknown node type: " + node.type);
    }
  }

  computeSliceParams(arrayLength: number, [start, stop, step]: [number | null, number | null, number | null]): [number, number, number] {
    if (step === null) {
      step = 1;
    } else if (step === 0) {
      var error = new Error("Invalid slice, step cannot be 0");
      error.name = "RuntimeError";
      throw error;
    }
    var stepValueNegative = step < 0 ? true : false;

    if (start === null) {
      start = stepValueNegative ? arrayLength - 1 : 0;
    } else {
      start = this.capSliceRange(arrayLength, start, step);
    }

    if (stop === null) {
      stop = stepValueNegative ? -1 : arrayLength;
    } else {
      stop = this.capSliceRange(arrayLength, stop, step);
    }
    return [start, stop, step];
  }

  capSliceRange(arrayLength: number, actualValue: number, step: number): number {
    if (actualValue < 0) {
      actualValue += arrayLength;
      if (actualValue < 0) {
        actualValue = step < 0 ? -1 : 0;
      }
    } else if (actualValue >= arrayLength) {
      actualValue = step < 0 ? arrayLength - 1 : arrayLength;
    }
    return actualValue;

  }
}

export class Runtime {
  public _interpreter!: TreeInterpreter;
  constructor() {
    this.functionTable = {
      // name: [function, <signature>]
      // The <signature> can be:
      //
      // {
      //   args: [[type1, type2], [type1, type2]],
      //   variadic: true|false
      // }
      //
      // Each arg in the arg list is a list of valid types
      // (if the function is overloaded and supports multiple
      // types.  If the type is "any" then no type checking
      // occurs on the argument.  Variadic is optional
      // and if not provided is assumed to be false.
      abs: { _func: this._functionAbs, _signature: [{ types: [Type.NUMBER] }] },
      avg: { _func: this._functionAvg, _signature: [{ types: [Type.ARRAY_NUMBER] }] },
      ceil: { _func: this._functionCeil, _signature: [{ types: [Type.NUMBER] }] },
      contains: {
        _func: this._functionContains,
        _signature: [{ types: [Type.STRING, Type.ARRAY] },
        { types: [Type.ANY] }]
      },
      "ends_with": {
        _func: this._functionEndsWith,
        _signature: [{ types: [Type.STRING] }, { types: [Type.STRING] }]
      },
      floor: { _func: this._functionFloor, _signature: [{ types: [Type.NUMBER] }] },
      length: {
        _func: this._functionLength,
        _signature: [{ types: [Type.STRING, Type.ARRAY, Type.OBJECT] }]
      },
      map: {
        _func: this._functionMap,
        _signature: [{ types: [Type.EXPREF] }, { types: [Type.ARRAY] }]
      },
      max: {
        _func: this._functionMax,
        _signature: [{ types: [Type.ARRAY_NUMBER, Type.ARRAY_STRING] }]
      },
      "merge": {
        _func: this._functionMerge,
        _signature: [{ types: [Type.OBJECT], variadic: true }]
      },
      "max_by": {
        _func: this._functionMaxBy,
        _signature: [{ types: [Type.ARRAY] }, { types: [Type.EXPREF] }]
      },
      sum: { _func: this._functionSum, _signature: [{ types: [Type.ARRAY_NUMBER] }] },
      "starts_with": {
        _func: this._functionStartsWith,
        _signature: [{ types: [Type.STRING] }, { types: [Type.STRING] }]
      },
      min: {
        _func: this._functionMin,
        _signature: [{ types: [Type.ARRAY_NUMBER, Type.ARRAY_STRING] }]
      },
      "min_by": {
        _func: this._functionMinBy,
        _signature: [{ types: [Type.ARRAY] }, { types: [Type.EXPREF] }]
      },
      type: { _func: this._functionType, _signature: [{ types: [Type.ANY] }] },
      keys: { _func: this._functionKeys, _signature: [{ types: [Type.OBJECT] }] },
      values: { _func: this._functionValues, _signature: [{ types: [Type.OBJECT] }] },
      sort: { _func: this._functionSort, _signature: [{ types: [Type.ARRAY_STRING, Type.ARRAY_NUMBER] }] },
      group_by: { _func: this._functionGroupBy, _signature: [{ types: [Type.ARRAY] }, { types: [Type.EXPREF] }] },
      "sort_by": {
        _func: this._functionSortBy,
        _signature: [{ types: [Type.ARRAY] }, { types: [Type.EXPREF] }]
      },
      join: {
        _func: this._functionJoin,
        _signature: [
          { types: [Type.STRING] },
          { types: [Type.ARRAY_STRING] }
        ]
      },
      reverse: {
        _func: this._functionReverse,
        _signature: [{ types: [Type.STRING, Type.ARRAY] }]
      },
      "to_array": { _func: this._functionToArray, _signature: [{ types: [Type.ANY] }] },
      "to_string": { _func: this._functionToString, _signature: [{ types: [Type.ANY] }] },
      "to_number": { _func: this._functionToNumber, _signature: [{ types: [Type.ANY] }] },
      "not_null": {
        _func: this._functionNotNull,
        _signature: [{ types: [Type.ANY], variadic: true }]
      }
    };
  }


  callFunction(name, resolvedArgs) {
    var functionEntry = this.functionTable[name];
    if (functionEntry === undefined) {
      throw new Error("Unknown function: " + name + "()");
    }
    this._validateArgs(name, resolvedArgs, functionEntry._signature);
    return functionEntry._func.call(this, resolvedArgs);
  }

  _validateArgs(name, args, signature) {
    // Validating the args requires validating
    // the correct arity and the correct type of each arg.
    // If the last argument is declared as variadic, then we need
    // a minimum number of args to be required.  Otherwise it has to
    // be an exact amount.
    var pluralized;
    if (signature[signature.length - 1].variadic) {
      if (args.length < signature.length) {
        pluralized = signature.length === 1 ? " argument" : " arguments";
        throw new Error("ArgumentError: " + name + "() " +
          "takes at least" + signature.length + pluralized +
          " but received " + args.length);
      }
    } else if (args.length !== signature.length) {
      pluralized = signature.length === 1 ? " argument" : " arguments";
      throw new Error("ArgumentError: " + name + "() " +
        "takes " + signature.length + pluralized +
        " but received " + args.length);
    }
    let typeMatched = false;
    for (var i = 0; i < signature.length; i++) {
      typeMatched = false;
      let currentSpec = signature[i].types;
      let actualType = this._getTypeName(args[i]);
      for (var j = 0; j < currentSpec.length; j++) {
        if (this._typeMatches(actualType, currentSpec[j], args[i])) {
          typeMatched = true;
          break;
        }
      }
      if (!typeMatched) {
        var expected = currentSpec
          .map(getTypeName)
          .join(',');
        throw new Error("TypeError: " + name + "() " +
          "expected argument " + (i + 1) +
          " to be type " + expected +
          " but received type " +
          TYPE_NAME_TABLE[actualType] + " instead.");
      }
    }
  }

  _typeMatches(actual, expected, argValue) {
    if (expected === Type.ANY) {
      return true;
    }
    if (expected === Type.ARRAY_STRING ||
      expected === Type.ARRAY_NUMBER ||
      expected === Type.ARRAY) {
      // The expected type can either just be array,
      // or it can require a specific subtype (array of numbers).
      //
      // The simplest case is if "array" with no subtype is specified.
      if (expected === Type.ARRAY) {
        return actual === Type.ARRAY;
      } else if (actual === Type.ARRAY) {
        // Otherwise we need to check subtypes.
        // I think this has potential to be improved.
        var subtype;
        if (expected === Type.ARRAY_NUMBER) {
          subtype = Type.NUMBER;
        } else if (expected === Type.ARRAY_STRING) {
          subtype = Type.STRING;
        }
        for (var i = 0; i < argValue.length; i++) {
          if (!this._typeMatches(
            this._getTypeName(argValue[i]), subtype,
            argValue[i])) {
            return false;
          }
        }
        return true;
      }
    } else {
      return actual === expected;
    }
  }
  _getTypeName(obj: unknown): Type {
    switch (Object.prototype.toString.call(obj)) {
      case "[object String]":
        return Type.STRING;
      case "[object Number]":
        return Type.NUMBER;
      case "[object Array]":
        return Type.ARRAY;
      case "[object Boolean]":
        return Type.BOOLEAN;
      case "[object Null]":
        return Type.NULL;
      case "[object Object]":
        // Check if it's an expref.  If it has, it's been
        // tagged with a jmespathType attr of 'Expref';
        if (obj.jmespathType === TOK.EXPREF) {
          return Type.EXPREF;
        } else {
          return Type.OBJECT;
        }
    }
    throw new Error("unexpected object type: " + Object.prototype.toString.call(obj));
  }

  _functionStartsWith(resolvedArgs) {
    return resolvedArgs[0].lastIndexOf(resolvedArgs[1]) === 0;
  }

  _functionEndsWith(resolvedArgs) {
    var searchStr = resolvedArgs[0];
    var suffix = resolvedArgs[1];
    return searchStr.indexOf(suffix, searchStr.length - suffix.length) !== -1;
  }

  _functionReverse(resolvedArgs) {
    var typeName = this._getTypeName(resolvedArgs[0]);
    if (typeName === Type.STRING) {
      var originalStr = resolvedArgs[0];
      var reversedStr = "";
      for (var i = originalStr.length - 1; i >= 0; i--) {
        reversedStr += originalStr[i];
      }
      return reversedStr;
    } else {
      var reversedArray = resolvedArgs[0].slice(0);
      reversedArray.reverse();
      return reversedArray;
    }
  }

  _functionAbs(resolvedArgs: [number]) {
    return Math.abs(resolvedArgs[0]);
  }

  _functionCeil(resolvedArgs: [number]) {
    return Math.ceil(resolvedArgs[0]);
  }

  _functionAvg(resolvedArgs: [number[]]) {
    var sum = 0;
    var inputArray = resolvedArgs[0];
    for (var i = 0; i < inputArray.length; i++) {
      sum += inputArray[i];
    }
    return sum / inputArray.length;
  }

  _functionContains(resolvedArgs) {
    return resolvedArgs[0].indexOf(resolvedArgs[1]) >= 0;
  }

  _functionFloor(resolvedArgs) {
    return Math.floor(resolvedArgs[0]);
  }

  _functionLength(resolvedArgs) {
    if (!isObject(resolvedArgs[0])) {
      return resolvedArgs[0].length;
    } else {
      // As far as I can tell, there's no way to get the length
      // of an object without O(n) iteration through the object.
      return Object.keys(resolvedArgs[0]).length;
    }
  }

  _functionMap(resolvedArgs) {
    var mapped = [];
    var interpreter = this._interpreter;
    var exprefNode = resolvedArgs[0];
    var elements = resolvedArgs[1];
    for (var i = 0; i < elements.length; i++) {
      mapped.push(interpreter.visit(exprefNode, elements[i]));
    }
    return mapped;
  }

  _functionMerge(resolvedArgs) {
    var merged = {};
    for (var i = 0; i < resolvedArgs.length; i++) {
      var current = resolvedArgs[i];
      for (var key in current) {
        merged[key] = current[key];
      }
    }
    return merged;
  }

  _functionMax(resolvedArgs) {
    if (resolvedArgs[0].length > 0) {
      var typeName = this._getTypeName(resolvedArgs[0][0]);
      if (typeName === Type.NUMBER) {
        return Math.max.apply(Math, resolvedArgs[0]);
      } else {
        var elements = resolvedArgs[0];
        var maxElement = elements[0];
        for (var i = 1; i < elements.length; i++) {
          if (maxElement.localeCompare(elements[i]) < 0) {
            maxElement = elements[i];
          }
        }
        return maxElement;
      }
    } else {
      return null;
    }
  }

  _functionMin(resolvedArgs) {
    if (resolvedArgs[0].length > 0) {
      var typeName = this._getTypeName(resolvedArgs[0][0]);
      if (typeName === Type.NUMBER) {
        return Math.min.apply(Math, resolvedArgs[0]);
      } else {
        var elements = resolvedArgs[0];
        var minElement = elements[0];
        for (var i = 1; i < elements.length; i++) {
          if (elements[i].localeCompare(minElement) < 0) {
            minElement = elements[i];
          }
        }
        return minElement;
      }
    } else {
      return null;
    }
  }

  _functionSum(resolvedArgs) {
    var sum = 0;
    var listToSum = resolvedArgs[0];
    for (var i = 0; i < listToSum.length; i++) {
      sum += listToSum[i];
    }
    return sum;
  }

  _functionType(resolvedArgs) {
    switch (this._getTypeName(resolvedArgs[0])) {
      case Type.NUMBER:
        return "number";
      case Type.STRING:
        return "string";
      case Type.ARRAY:
        return "array";
      case Type.OBJECT:
        return "object";
      case Type.BOOLEAN:
        return "boolean";
      case Type.EXPREF:
        return "expref";
      case Type.NULL:
        return "null";
    }
  }

  _functionKeys(resolvedArgs) {
    return Object.keys(resolvedArgs[0]);
  }

  _functionValues(resolvedArgs) {
    var obj = resolvedArgs[0];
    var keys = Object.keys(obj);
    var values = [];
    for (var i = 0; i < keys.length; i++) {
      values.push(obj[keys[i]]);
    }
    return values;
  }

  _functionJoin(resolvedArgs) {
    var joinChar = resolvedArgs[0];
    var listJoin = resolvedArgs[1];
    return listJoin.join(joinChar);
  }

  _functionToArray(resolvedArgs) {
    if (this._getTypeName(resolvedArgs[0]) === Type.ARRAY) {
      return resolvedArgs[0];
    } else {
      return [resolvedArgs[0]];
    }
  }

  _functionToString(resolvedArgs) {
    if (this._getTypeName(resolvedArgs[0]) === Type.STRING) {
      return resolvedArgs[0];
    } else {
      return JSON.stringify(resolvedArgs[0]);
    }
  }

  _functionToNumber(resolvedArgs) {
    var typeName = this._getTypeName(resolvedArgs[0]);
    var convertedValue;
    if (typeName === Type.NUMBER) {
      return resolvedArgs[0];
    } else if (typeName === Type.STRING) {
      convertedValue = +resolvedArgs[0];
      if (!isNaN(convertedValue)) {
        return convertedValue;
      }
    }
    return null;
  }

  _functionNotNull(resolvedArgs) {
    for (var i = 0; i < resolvedArgs.length; i++) {
      if (this._getTypeName(resolvedArgs[i]) !== Type.NULL) {
        return resolvedArgs[i];
      }
    }
    return null;
  }

  _functionSort(resolvedArgs) {
    var sortedArray = resolvedArgs[0].slice(0);
    sortedArray.sort();
    return sortedArray;
  }

  _functionGroupBy(resolvedArgs) {
    var exprefNode = resolvedArgs[1];
    var array = resolvedArgs[0];
    var keyFunction = this.createKeyFunction(exprefNode, [Type.NUMBER, Type.STRING]);
    var groups = {};
    for (var i = 0; i < array.length; i++) {
      var key = keyFunction(array[i]);
      const group = groups[key] ??= [];
      group.push(array[i]);
    }
    return groups;
  }

  _functionSortBy(resolvedArgs) {
    var sortedArray = resolvedArgs[0].slice(0);
    if (sortedArray.length === 0) {
      return sortedArray;
    }
    var interpreter = this._interpreter;
    var exprefNode = resolvedArgs[1];
    var requiredType = this._getTypeName(
      interpreter.visit(exprefNode, sortedArray[0]));
    if ([Type.NUMBER, Type.STRING].indexOf(requiredType) < 0) {
      throw new Error("TypeError");
    }
    var that = this;
    // In order to get a stable sort out of an unstable
    // sort algorithm, we decorate/sort/undecorate (DSU)
    // by creating a new list of [index, element] pairs.
    // In the cmp function, if the evaluated elements are
    // equal, then the index will be used as the tiebreaker.
    // After the decorated list has been sorted, it will be
    // undecorated to extract the original elements.
    var decorated = [];
    for (var i = 0; i < sortedArray.length; i++) {
      decorated.push([i, sortedArray[i]]);
    }
    decorated.sort(function (a, b) {
      var exprA = interpreter.visit(exprefNode, a[1]);
      var exprB = interpreter.visit(exprefNode, b[1]);
      if (that._getTypeName(exprA) !== requiredType) {
        throw new Error(
          "TypeError: expected " + requiredType + ", received " +
          that._getTypeName(exprA));
      } else if (that._getTypeName(exprB) !== requiredType) {
        throw new Error(
          "TypeError: expected " + requiredType + ", received " +
          that._getTypeName(exprB));
      }
      if (exprA > exprB) {
        return 1;
      } else if (exprA < exprB) {
        return -1;
      } else {
        // If they're equal compare the items by their
        // order to maintain relative order of equal keys
        // (i.e. to get a stable sort).
        return a[0] - b[0];
      }
    });
    // Undecorate: extract out the original list elements.
    for (var j = 0; j < decorated.length; j++) {
      sortedArray[j] = decorated[j][1];
    }
    return sortedArray;
  }

  _functionMaxBy(resolvedArgs) {
    var exprefNode = resolvedArgs[1];
    var resolvedArray = resolvedArgs[0];
    var keyFunction = this.createKeyFunction(exprefNode, [Type.NUMBER, Type.STRING]);
    var maxNumber = -Infinity;
    var maxRecord;
    var current;
    for (var i = 0; i < resolvedArray.length; i++) {
      current = keyFunction(resolvedArray[i]);
      if (current > maxNumber) {
        maxNumber = current;
        maxRecord = resolvedArray[i];
      }
    }
    return maxRecord;
  }

  _functionMinBy(resolvedArgs) {
    var exprefNode = resolvedArgs[1];
    var resolvedArray = resolvedArgs[0];
    var keyFunction = this.createKeyFunction(exprefNode, [Type.NUMBER, Type.STRING]);
    var minNumber = Infinity;
    var minRecord;
    var current;
    for (var i = 0; i < resolvedArray.length; i++) {
      current = keyFunction(resolvedArray[i]);
      if (current < minNumber) {
        minNumber = current;
        minRecord = resolvedArray[i];
      }
    }
    return minRecord;
  }

  createKeyFunction(exprefNode, allowedTypes) {
    var that = this;
    var interpreter = this._interpreter;
    var keyFunc = function (x) {
      var current = interpreter.visit(exprefNode, x);
      if (allowedTypes.indexOf(that._getTypeName(current)) < 0) {
        var msg = "TypeError: expected one of " + allowedTypes +
          ", received " + that._getTypeName(current);
        throw new Error(msg);
      }
      return current;
    };
    return keyFunc;

  }
}

export function compile(stream: string): Exp {
  var parser = new Parser();
  var ast = parser.parse(stream);
  return ast;
}

export function tokenize(stream: string): Token[] {
  var lexer = new Lexer();
  return lexer.tokenize(stream);
}

export function search(data: unknown, expression: string): unknown {
  var parser = new Parser();
  // This needs to be improved.  Both the interpreter and runtime depend on
  // each other.  The runtime needs the interpreter to support exprefs.
  // There's likely a clean way to avoid the cyclic dependency.
  var runtime = new Runtime();
  var interpreter = new TreeInterpreter(runtime);
  runtime._interpreter = interpreter;
  var node = parser.parse(expression);
  return interpreter.search(node, data);
}

export default {
  Lexer,
  Parser,
  TreeInterpreter,
  Runtime,
  tokenize,
  compile,
  search,
  strictDeepEqual
}
