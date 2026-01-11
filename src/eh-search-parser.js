// ============================================================
// E-H Search Query Parser & SQLite Generator
// 可獨立使用的模組版本
// ============================================================

// ============================================================
// BNF Grammar Specification (完整語法規範)
// ============================================================
//
// <query>          ::= <term>*
//
// <term>           ::= <prefix>? <weak-modifier>? <atom>
//
// <prefix>         ::= "-"                         // 排除 (exclude)
//                    | "~"                         // OR 群組
//
// <weak-modifier>  ::= "weak" ":"                  // weak 標籤修飾符 (不可與 - 併用)
//
// <atom>           ::= <tag-query>
//                    | <text-query>
//                    | <user-query>
//                    | <integer-query>
//
// ------------------------------------------------------------
// Tag Query (標籤查詢)
// ------------------------------------------------------------
// <tag-query>      ::= <namespace> ":" <tag-value> <suffix>?
//                    | "tag" ":" <tag-value> <suffix>?
//
// <namespace>      ::= "artist" | "a"              // 藝術家
//                    | "character" | "c" | "char"  // 角色
//                    | "cosplayer" | "cos"         // Cosplayer
//                    | "female" | "f"              // 女性標籤
//                    | "group" | "g" | "circle"    // 社團
//                    | "language" | "l" | "lang"   // 語言
//                    | "location" | "loc"          // 地點
//                    | "male" | "m"                // 男性標籤
//                    | "mixed" | "x"               // 混合標籤
//                    | "other" | "o"               // 其他標籤
//                    | "parody" | "p" | "series"   // 作品/系列
//                    | "reclass" | "r"             // 重新分類
//
// <tag-value>      ::= <quoted-string>             // "big breasts"
//                    | <bare-word>                 // vtuber, sasaki_saku
//                    | "*"                         // 萬用 (僅用於 -namespace:*)
//
// <suffix>         ::= "$"                         // 精確匹配
//                    | "*"                         // 萬用字元 (前綴匹配)
//                    | "%"                         // 萬用字元 (同 *)
//
// ------------------------------------------------------------
// Text Query (文字查詢)
// ------------------------------------------------------------
// <text-query>     ::= "title" ":" <text-value> <wildcard>?
//                    | "comment" ":" <text-value> <wildcard>?
//                    | "favnote" ":" <text-value> <wildcard>?
//                    | <text-value> <wildcard>?    // 純文字搜尋 (標題+標籤)
//
// <text-value>     ::= <quoted-string>
//                    | <bare-word>
//
// <wildcard>       ::= "*" | "%"
//
// ------------------------------------------------------------
// User Query (使用者查詢)
// ------------------------------------------------------------
// <user-query>     ::= "uploader" ":" <username>
//
// <username>       ::= <quoted-string>
//                    | <bare-word>
//
// ------------------------------------------------------------
// Integer Query (數值查詢)
// ------------------------------------------------------------
// <integer-query>  ::= "gid" ":" <integer>         // Gallery ID
//                    | "uploaduid" ":" <integer>   // 上傳者 UID
//
// <integer>        ::= [0-9]+
//
// ------------------------------------------------------------
// Lexical Elements (詞法元素)
// ------------------------------------------------------------
// <quoted-string>  ::= '"' <any-char-except-quote>* '"'
//
// <bare-word>      ::= <word-char>+
//                    // 底線 (_) 會被轉換為空白
//                    // 不可包含: 空白, ",", ":", "~", '"'
//
// <word-char>      ::= 任何非特殊字元
//
// ------------------------------------------------------------
// Semantic Rules (語意規則)
// ------------------------------------------------------------
// 1. 多個 term 預設為 AND 關係
// 2. 帶有 ~ 前綴的 term 會組成 OR 群組
// 3. OR 群組中的所有項目必須一致地全用或全不用 weak:
// 4. weak: 不可與 - (排除) 前綴併用
// 5. -namespace:* 表示排除該命名空間的所有標籤
//
// ------------------------------------------------------------
// Examples (範例)
// ------------------------------------------------------------
// f:vtuber                     → female:vtuber 標籤
// -m:*                         → 排除所有 male 標籤
// ~l:chinese ~l:japanese       → 語言為中文或日文
// c:sasaki_saku$               → 精確匹配角色 "sasaki saku"
// title:"comic aun"            → 標題包含 "comic aun"
// f:vtuber l:chinese -m:*      → VTuber + 中文 + 排除男性標籤
// weak:f:vtuber                → 搜尋 weak 標籤
//
// ============================================================

// Namespace aliases mapping to full namespace names
const NAMESPACE_ALIASES = {
    'artist': 'artist', 'a': 'artist',
    'character': 'character', 'c': 'character', 'char': 'character',
    'cosplayer': 'cosplayer', 'cos': 'cosplayer',
    'female': 'female', 'f': 'female',
    'group': 'group', 'g': 'group', 'circle': 'group',
    'language': 'language', 'l': 'language', 'lang': 'language',
    'location': 'location', 'loc': 'location',
    'male': 'male', 'm': 'male',
    'mixed': 'mixed', 'x': 'mixed',
    'other': 'other', 'o': 'other',
    'parody': 'parody', 'p': 'parody', 'series': 'parody',
    'reclass': 'reclass', 'r': 'reclass'
};

const ALL_NAMESPACES = Object.keys(NAMESPACE_ALIASES);

// Token types
const TokenType = {
    QUOTED: 'QUOTED',
    BARE: 'BARE',
    COLON: 'COLON',
    TILDE: 'TILDE',
    MINUS: 'MINUS',
    DOLLAR: 'DOLLAR',
    WILDCARD: 'WILDCARD',
    EOF: 'EOF'
};

// ============================================================
// Lexer (Tokenizer)
// ============================================================
class Lexer {
    constructor(input) {
        this.input = input;
        this.pos = 0;
        this.tokens = [];
    }

    isWhitespace(ch) {
        return ch === ' ' || ch === '\t' || ch === ',';
    }

    isDigit(ch) {
        return ch >= '0' && ch <= '9';
    }

    peek(offset = 0) {
        return this.input[this.pos + offset] || '';
    }

    advance() {
        return this.input[this.pos++] || '';
    }

    skipWhitespace() {
        while (this.pos < this.input.length && this.isWhitespace(this.peek())) {
            this.advance();
        }
    }

    readQuoted() {
        this.advance(); // skip opening quote
        let value = '';
        while (this.pos < this.input.length && this.peek() !== '"') {
            value += this.advance();
        }
        if (this.peek() === '"') {
            this.advance(); // skip closing quote
        }
        return { type: TokenType.QUOTED, value };
    }

    readBare() {
        let value = '';
        while (this.pos < this.input.length) {
            const ch = this.peek();
            if (this.isWhitespace(ch) || ch === '"' || ch === ':' || ch === '~' || ch === '-' && value.length === 0) {
                break;
            }
            // Check for trailing modifiers
            if ((ch === '$' || ch === '*' || ch === '%') && this.pos + 1 < this.input.length) {
                const next = this.peek(1);
                if (this.isWhitespace(next) || next === '' || next === '"') {
                    break;
                }
            }
            if (ch === '$' || ch === '*' || ch === '%') {
                // End of input or next is whitespace
                if (this.pos + 1 >= this.input.length || this.isWhitespace(this.peek(1))) {
                    break;
                }
            }
            value += this.advance();
        }
        return { type: TokenType.BARE, value };
    }

    tokenize() {
        while (this.pos < this.input.length) {
            this.skipWhitespace();
            if (this.pos >= this.input.length) break;

            const ch = this.peek();

            if (ch === '"') {
                this.tokens.push(this.readQuoted());
            } else if (ch === ':') {
                this.advance();
                this.tokens.push({ type: TokenType.COLON, value: ':' });
            } else if (ch === '~') {
                this.advance();
                this.tokens.push({ type: TokenType.TILDE, value: '~' });
            } else if (ch === '-') {
                this.advance();
                this.tokens.push({ type: TokenType.MINUS, value: '-' });
            } else if (ch === '$') {
                this.advance();
                this.tokens.push({ type: TokenType.DOLLAR, value: '$' });
            } else if (ch === '*' || ch === '%') {
                this.advance();
                this.tokens.push({ type: TokenType.WILDCARD, value: ch });
            } else {
                const token = this.readBare();
                if (token.value.length > 0) {
                    this.tokens.push(token);
                }
            }
        }
        this.tokens.push({ type: TokenType.EOF, value: '' });
        return this.tokens;
    }
}

// ============================================================
// Parser
// ============================================================
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    peek(offset = 0) {
        return this.tokens[this.pos + offset] || { type: TokenType.EOF, value: '' };
    }

    advance() {
        return this.tokens[this.pos++] || { type: TokenType.EOF, value: '' };
    }

    match(type) {
        if (this.peek().type === type) {
            return this.advance();
        }
        return null;
    }

    parse() {
        const terms = [];
        while (this.peek().type !== TokenType.EOF) {
            const term = this.parseTerm();
            if (term) {
                terms.push(term);
            }
        }
        return { type: 'Query', terms };
    }

    parseTerm() {
        let prefix = null;
        let isWeak = false;

        // Check for prefix (- or ~)
        if (this.peek().type === TokenType.MINUS) {
            this.advance();
            prefix = 'exclude';
        } else if (this.peek().type === TokenType.TILDE) {
            this.advance();
            prefix = 'or';
        }

        // Check for weak: at the beginning
        if (this.peek().type === TokenType.BARE && this.peek().value.toLowerCase() === 'weak' &&
            this.peek(1).type === TokenType.COLON) {
            if (prefix === 'exclude') {
                throw new Error('weak: 不可與排除前綴 - 併用');
            }
            this.advance(); // consume 'weak'
            this.advance(); // consume ':'
            isWeak = true;
        }

        const atom = this.parseAtom(isWeak);
        if (atom) {
            atom.prefix = prefix;
            atom.isWeak = isWeak;
            return atom;
        }
        return null;
    }

    parseAtom(isWeak) {
        const token = this.peek();

        // Check if it's a qualifier or namespace
        if (token.type === TokenType.BARE && this.peek(1).type === TokenType.COLON) {
            const qualifier = token.value.toLowerCase();
            
            // Check for qualifiers
            if (qualifier === 'tag') {
                this.advance(); // consume qualifier
                this.advance(); // consume ':'
                return this.parseTagToken('tag');
            } else if (qualifier === 'title') {
                this.advance();
                this.advance();
                return this.parseTextToken('title');
            } else if (qualifier === 'uploader') {
                this.advance();
                this.advance();
                return this.parseUserToken('uploader');
            } else if (qualifier === 'uploaduid') {
                this.advance();
                this.advance();
                return this.parseInteger('uploaduid');
            } else if (qualifier === 'gid') {
                this.advance();
                this.advance();
                return this.parseInteger('gid');
            } else if (qualifier === 'comment') {
                this.advance();
                this.advance();
                return this.parseTextToken('comment');
            } else if (qualifier === 'favnote') {
                this.advance();
                this.advance();
                return this.parseTextToken('favnote');
            } else if (ALL_NAMESPACES.includes(qualifier)) {
                // It's a namespace
                this.advance();
                this.advance();
                return this.parseTagToken(NAMESPACE_ALIASES[qualifier]);
            }
        }

        // Plain text search
        return this.parseTextToken('text');
    }

    parseTagToken(namespace) {
        let value = '';
        let exact = false;
        let wildcard = false;

        const token = this.peek();
        if (token.type === TokenType.QUOTED) {
            this.advance();
            value = token.value;
            if (value.endsWith('$')) {
                value = value.slice(0, -1);
                exact = true;
            }
        } else if (token.type === TokenType.BARE) {
            this.advance();
            // Replace underscores with spaces
            value = token.value.replace(/_/g, ' ');
        } else {
            return null;
        }

        // Check for exact ($) or wildcard (* / %)
        if (this.peek().type === TokenType.DOLLAR) {
            this.advance();
            exact = true;
        } else if (this.peek().type === TokenType.WILDCARD) {
            this.advance();
            wildcard = true;
        }

        return {
            type: 'TagQuery',
            namespace,
            value,
            exact,
            wildcard
        };
    }

    parseTextToken(qualifier) {
        let value = '';
        let wildcard = false;

        const token = this.peek();
        if (token.type === TokenType.QUOTED) {
            this.advance();
            value = token.value;
        } else if (token.type === TokenType.BARE) {
            this.advance();
            value = token.value.replace(/_/g, ' ');
        } else {
            return null;
        }

        // Check for wildcard
        if (this.peek().type === TokenType.WILDCARD) {
            this.advance();
            wildcard = true;
        }

        return {
            type: 'TextQuery',
            qualifier,
            value,
            wildcard
        };
    }

    parseUserToken(qualifier) {
        let value = '';

        const token = this.peek();
        if (token.type === TokenType.QUOTED) {
            this.advance();
            value = token.value;
        } else if (token.type === TokenType.BARE) {
            this.advance();
            value = token.value;
        } else {
            return null;
        }

        return {
            type: 'UserQuery',
            qualifier,
            value
        };
    }

    parseInteger(qualifier) {
        const token = this.peek();
        if (token.type === TokenType.BARE && /^\d+$/.test(token.value)) {
            this.advance();
            return {
                type: 'IntegerQuery',
                qualifier,
                value: parseInt(token.value, 10)
            };
        }
        return null;
    }
}

// ============================================================
// SQL Generator (使用 LIKE，適用於一般 SQLite)
// ============================================================
class SQLGenerator {
    constructor(ast) {
        this.ast = ast;
        this.params = [];
    }

    generate() {
        const terms = this.ast.terms;
        if (terms.length === 0) {
            return { sql: 'SELECT * FROM data', params: [] };
        }

        // Separate terms into categories
        const andTerms = terms.filter(t => t.prefix !== 'or');
        const orTerms = terms.filter(t => t.prefix === 'or');

        // Validate OR group weak consistency
        if (orTerms.length > 0) {
            const weakCount = orTerms.filter(t => t.isWeak).length;
            if (weakCount > 0 && weakCount !== orTerms.length) {
                throw new Error('OR 群組中，所有項目必須一致地全用或全不用 weak:');
            }
        }

        const conditions = [];

        // Process AND terms (including exclusions)
        for (const term of andTerms) {
            const cond = this.generateCondition(term);
            if (cond) {
                if (term.prefix === 'exclude') {
                    conditions.push(`NOT (${cond})`);
                } else {
                    conditions.push(cond);
                }
            }
        }

        // Process OR terms
        if (orTerms.length > 0) {
            const orConditions = orTerms.map(t => this.generateCondition(t)).filter(Boolean);
            if (orConditions.length > 0) {
                conditions.push(`(${orConditions.join(' OR ')})`);
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        return {
            sql: `SELECT * FROM data ${whereClause}`.trim(),
            params: this.params
        };
    }

    generateCondition(term) {
        if (term.type === 'TagQuery') {
            return this.generateTagCondition(term);
        } else if (term.type === 'TextQuery') {
            return this.generateTextCondition(term);
        } else if (term.type === 'UserQuery') {
            return this.generateUserCondition(term);
        } else if (term.type === 'IntegerQuery') {
            return this.generateIntegerCondition(term);
        }
        return null;
    }

    generateTagCondition(term) {
        const { namespace, value, exact, wildcard } = term;
        const escapedValue = this.escapeLike(value);
        
        let pattern;
        if (namespace === 'tag') {
            if (exact) {
                pattern = `%:${escapedValue}'%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            } else if (wildcard) {
                pattern = `%:${escapedValue}%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            } else {
                pattern = `%:${escapedValue}%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            }
        } else {
            if (exact) {
                pattern = `%'${namespace}:${escapedValue}'%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            } else if (wildcard) {
                pattern = `%${namespace}:${escapedValue}%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            } else {
                pattern = `%${namespace}:${escapedValue}%`;
                return `tags LIKE ${this.addParam(pattern)} ESCAPE '\\'`;
            }
        }
    }
    
    escapeLike(value) {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_');
    }

    generateTextCondition(term) {
        const { qualifier, value, wildcard } = term;
        
        if (qualifier === 'title') {
            const pattern = `%${value}%`;
            const p = this.addParam(pattern);
            return `(title LIKE ${p} OR title_jpn LIKE ${p})`;
        } else if (qualifier === 'comment') {
            const pattern = `%${value}%`;
            return `comment LIKE ${this.addParam(pattern)}`;
        } else if (qualifier === 'favnote') {
            const pattern = `%${value}%`;
            return `favnote LIKE ${this.addParam(pattern)}`;
        } else {
            const pattern = `%${value}%`;
            const p = this.addParam(pattern);
            return `(title LIKE ${p} OR title_jpn LIKE ${p} OR tags LIKE ${p})`;
        }
    }

    generateUserCondition(term) {
        const { value } = term;
        return `uploader = ${this.addParam(value)}`;
    }

    generateIntegerCondition(term) {
        const { qualifier, value } = term;
        if (qualifier === 'gid') {
            return `gid = ${this.addParam(value)}`;
        } else if (qualifier === 'uploaduid') {
            return `uploaduid = ${this.addParam(value)}`;
        }
        return null;
    }

    addParam(value) {
        this.params.push(value);
        return '?';
    }
}

// ============================================================
// Inline SQL Generator (內嵌值版本，適用於直接執行)
// ============================================================
class InlineSQLGenerator {
    constructor(ast) {
        this.ast = ast;
    }

    generate() {
        const terms = this.ast.terms;
        if (terms.length === 0) {
            return { sql: 'SELECT * FROM data', ftsQuery: null };
        }

        const andTerms = terms.filter(t => t.prefix !== 'or');
        const orTerms = terms.filter(t => t.prefix === 'or');

        if (orTerms.length > 0) {
            const weakCount = orTerms.filter(t => t.isWeak).length;
            if (weakCount > 0 && weakCount !== orTerms.length) {
                throw new Error('OR 群組中，所有項目必須一致地全用或全不用 weak:');
            }
        }

        const conditions = [];

        for (const term of andTerms) {
            const cond = this.generateSQLCondition(term);
            if (cond) {
                if (term.prefix === 'exclude') {
                    conditions.push(`NOT (${cond})`);
                } else {
                    conditions.push(cond);
                }
            }
        }

        if (orTerms.length > 0) {
            const orConditions = orTerms.map(t => this.generateSQLCondition(t)).filter(Boolean);
            if (orConditions.length > 0) {
                conditions.push(`(${orConditions.join(' OR ')})`);
            }
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM data ${whereClause}`.trim();

        return { sql };
    }

    generateSQLCondition(term) {
        if (term.type === 'TagQuery') {
            return this.generateTagCondition(term);
        } else if (term.type === 'TextQuery') {
            return this.generateTextCondition(term);
        } else if (term.type === 'IntegerQuery') {
            return this.generateIntegerCondition(term);
        } else if (term.type === 'UserQuery') {
            return this.generateUserCondition(term);
        }
        return null;
    }

    generateTagCondition(term) {
        const { namespace, value, exact, wildcard } = term;
        const escapedValue = this.escapeLike(value);
        
        if (namespace === 'tag') {
            if (exact) {
                return `tags LIKE '%''%:${escapedValue}''%' ESCAPE '\\'`;
            } else {
                return `tags LIKE '%${escapedValue}%' ESCAPE '\\'`;
            }
        } else {
            if (exact) {
                return `tags LIKE '%''${namespace}:${escapedValue}''%' ESCAPE '\\'`;
            } else if (wildcard) {
                return `tags LIKE '%${namespace}:${escapedValue}%' ESCAPE '\\'`;
            } else {
                return `tags LIKE '%${namespace}:${escapedValue}%' ESCAPE '\\'`;
            }
        }
    }
    
    escapeLike(value) {
        return value
            .replace(/\\/g, '\\\\')
            .replace(/%/g, '\\%')
            .replace(/_/g, '\\_');
    }

    generateTextCondition(term) {
        const { qualifier, value, wildcard } = term;
        const pattern = `%${value}%`;
        
        if (qualifier === 'title') {
            return `(title LIKE '${pattern}' OR title_jpn LIKE '${pattern}')`;
        } else if (qualifier === 'comment') {
            return `comment LIKE '${pattern}'`;
        } else if (qualifier === 'favnote') {
            return `favnote LIKE '${pattern}'`;
        } else {
            return `(title LIKE '${pattern}' OR title_jpn LIKE '${pattern}' OR tags LIKE '${pattern}')`;
        }
    }

    generateIntegerCondition(term) {
        const { qualifier, value } = term;
        if (qualifier === 'gid') {
            return `gid = ${value}`;
        } else if (qualifier === 'uploaduid') {
            return `uploaduid = ${value}`;
        }
        return null;
    }

    generateUserCondition(term) {
        return `uploader = '${term.value}'`;
    }
}

// ============================================================
// Main conversion function
// ============================================================
function convertQuery(input) {
    if (!input || input.trim() === '') {
        return {
            ast: null,
            sql: 'SELECT * FROM data',
            params: [],
            error: null
        };
    }

    try {
        // Tokenize
        const lexer = new Lexer(input.trim());
        const tokens = lexer.tokenize();

        // Parse
        const parser = new Parser(tokens);
        const ast = parser.parse();

        // Generate SQL (using inline generator for inline values)
        const inlineGen = new InlineSQLGenerator(ast);
        const inlineResult = inlineGen.generate();

        // Also generate parameterized version
        const sqlGen = new SQLGenerator(ast);
        const sqlResult = sqlGen.generate();

        return {
            ast,
            sql: inlineResult.sql,           // 內嵌值版本
            sqlParameterized: sqlResult.sql, // 參數化版本
            params: sqlResult.params,        // 參數陣列
            error: null
        };
    } catch (error) {
        return {
            ast: null,
            sql: null,
            params: [],
            error: error.message
        };
    }
}

// ============================================================
// Export for different environments
// ============================================================

// ES Module export
if (typeof module !== 'undefined' && module.exports) {
    // CommonJS (Node.js)
    module.exports = {
        convertQuery
    };
}