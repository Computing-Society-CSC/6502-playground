import type * as Monaco from "monaco-editor";

// --- Data for Instructions (Descriptions, Addressing Modes) ---
// Source: Based on common 6502 documentation (e.g., http://www.obelisk.me.uk/6502/reference.html)
const instructionSet = {
    // Official Opcodes
    ADC: { desc: "Add with Carry", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    AND: { desc: "Logical AND", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    ASL: { desc: "Arithmetic Shift Left", modes: "Accumulator, Zero Page, Zero Page,X, Absolute, Absolute,X" },
    BCC: { desc: "Branch if Carry Clear", modes: "Relative" },
    BCS: { desc: "Branch if Carry Set", modes: "Relative" },
    BEQ: { desc: "Branch if Equal (Zero set)", modes: "Relative" },
    BIT: { desc: "Bit Test", modes: "Zero Page, Absolute" },
    BMI: { desc: "Branch if Minus (Negative set)", modes: "Relative" },
    BNE: { desc: "Branch if Not Equal (Zero clear)", modes: "Relative" },
    BPL: { desc: "Branch if Plus (Negative clear)", modes: "Relative" },
    BRK: { desc: "Force Interrupt", modes: "Implied" },
    BVC: { desc: "Branch if Overflow Clear", modes: "Relative" },
    BVS: { desc: "Branch if Overflow Set", modes: "Relative" },
    CLC: { desc: "Clear Carry Flag", modes: "Implied" },
    CLD: { desc: "Clear Decimal Mode", modes: "Implied" },
    CLI: { desc: "Clear Interrupt Disable", modes: "Implied" },
    CLV: { desc: "Clear Overflow Flag", modes: "Implied" },
    CMP: { desc: "Compare Accumulator", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    CPX: { desc: "Compare X Register", modes: "Immediate, Zero Page, Absolute" },
    CPY: { desc: "Compare Y Register", modes: "Immediate, Zero Page, Absolute" },
    DEC: { desc: "Decrement Memory", modes: "Zero Page, Zero Page,X, Absolute, Absolute,X" },
    DEX: { desc: "Decrement X Register", modes: "Implied" },
    DEY: { desc: "Decrement Y Register", modes: "Implied" },
    EOR: { desc: "Exclusive OR", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    INC: { desc: "Increment Memory", modes: "Zero Page, Zero Page,X, Absolute, Absolute,X" },
    INX: { desc: "Increment X Register", modes: "Implied" },
    INY: { desc: "Increment Y Register", modes: "Implied" },
    JMP: { desc: "Jump", modes: "Absolute, Indirect" },
    JSR: { desc: "Jump to Subroutine", modes: "Absolute" },
    LDA: { desc: "Load Accumulator", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    LDX: { desc: "Load X Register", modes: "Immediate, Zero Page, Zero Page,Y, Absolute, Absolute,Y" },
    LDY: { desc: "Load Y Register", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X" },
    LSR: { desc: "Logical Shift Right", modes: "Accumulator, Zero Page, Zero Page,X, Absolute, Absolute,X" },
    NOP: { desc: "No Operation", modes: "Implied" },
    ORA: { desc: "Logical Inclusive OR", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    PHA: { desc: "Push Accumulator", modes: "Implied" },
    PHP: { desc: "Push Processor Status", modes: "Implied" },
    PLA: { desc: "Pull Accumulator", modes: "Implied" },
    PLP: { desc: "Pull Processor Status", modes: "Implied" },
    ROL: { desc: "Rotate Left", modes: "Accumulator, Zero Page, Zero Page,X, Absolute, Absolute,X" },
    ROR: { desc: "Rotate Right", modes: "Accumulator, Zero Page, Zero Page,X, Absolute, Absolute,X" },
    RTI: { desc: "Return from Interrupt", modes: "Implied" },
    RTS: { desc: "Return from Subroutine", modes: "Implied" },
    SBC: { desc: "Subtract with Carry", modes: "Immediate, Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    SEC: { desc: "Set Carry Flag", modes: "Implied" },
    SED: { desc: "Set Decimal Mode", modes: "Implied" },
    SEI: { desc: "Set Interrupt Disable", modes: "Implied" },
    STA: { desc: "Store Accumulator", modes: "Zero Page, Zero Page,X, Absolute, Absolute,X, Absolute,Y, (Indirect,X), (Indirect),Y" },
    STX: { desc: "Store X Register", modes: "Zero Page, Zero Page,Y, Absolute" },
    STY: { desc: "Store Y Register", modes: "Zero Page, Zero Page,X, Absolute" },
    TAX: { desc: "Transfer A to X", modes: "Implied" },
    TAY: { desc: "Transfer A to Y", modes: "Implied" },
    TSX: { desc: "Transfer Stack Pointer to X", modes: "Implied" },
    TXA: { desc: "Transfer X to A", modes: "Implied" },
    TXS: { desc: "Transfer X to Stack Pointer", modes: "Implied" },
    TYA: { desc: "Transfer Y to A", modes: "Implied" },
    // Add common illegal/undocumented opcodes if desired (e.g., LAX, SAX, DCP, ISB, SLO, RLA, SRE, RRA)
    // LAX: { desc: "Load A and X (Illegal)", modes: "..." },
};

const directives = {
    // Common directives (syntax may vary slightly between assemblers like ca65, vasm, acme)
    ORG: { desc: "Set Program Origin Address", snippet: "ORG \\$${1:address}" },
    EQU: { desc: "Equate Symbol to Value", snippet: "${1:SYMBOL} EQU ${2:value}" },
    '=': { desc: "Assign Value to Symbol (like EQU, often re-assignable)", snippet: "${1:symbol} = ${2:value}" },
    BYTE: { desc: "Define Byte(s)", snippet: ".BYTE ${1:value1}, ${2:value2}" },
    WORD: { desc: "Define Word(s) (16-bit)", snippet: ".WORD ${1:value1}, ${2:value2}" },
    DBYTE: { desc: "Define Double Byte(s) (16-bit, like WORD)", snippet: ".DBYTE ${1:value1}, ${2:value2}" },
    DWORD: { desc: "Define Double Word(s) (32-bit)", snippet: ".DWORD ${1:value1}, ${2:value2}" },
    ASCII: { desc: "Define ASCII String", snippet: '.ASCII "${1:string}"' },
    ASCIZ: { desc: "Define Zero-Terminated ASCII String", snippet: '.ASCIZ "${1:string}"' }, // Common extension
    PETSCII: { desc: "Define PETSCII String", snippet: '.PETSCII "${1:string}"' }, // Common for C64
    SCREEN: { desc: "Define Screen Code String", snippet: '.SCREEN "${1:string}"' }, // Common for C64
    INCLUDE: { desc: "Include External File", snippet: '.INCLUDE "${1:filename}"' },
    INCBIN: { desc: "Include Binary File", snippet: '.INCBIN "${1:filename}"' },
    MACRO: { desc: "Define Macro", snippet: ".MACRO ${1:name}\n\t${2:body}\n.ENDM" },
    ENDM: { desc: "End Macro Definition", snippet: ".ENDM" },
    IF: { desc: "Conditional Assembly", snippet: ".IF ${1:condition}\n\t${2:code}\n.ENDIF" },
    IFDEF: { desc: "Conditional Assembly (if defined)", snippet: ".IFDEF ${1:symbol}\n\t${2:code}\n.ENDIF" },
    IFNDEF: { desc: "Conditional Assembly (if not defined)", snippet: ".IFNDEF ${1:symbol}\n\t${2:code}\n.ENDIF" },
    ELSE: { desc: "Else for Conditional Assembly", snippet: ".ELSE" },
    ENDIF: { desc: "End Conditional Assembly", snippet: ".ENDIF" },
    DEFINE: { desc: "Define Symbol (for IFDEF)", snippet: ".DEFINE ${1:symbol}" }, // Common alternative
    SET: { desc: "Assign Value (like =, often re-assignable)", snippet: ".SET ${1:symbol} = ${2:value}" }, // Common alternative
    ALIGN: { desc: "Align Program Counter", snippet: ".ALIGN ${1:boundary}" },
    FILL: { desc: "Fill Memory with Value", snippet: ".FILL ${1:count}, ${2:value}" },
    // Add more as needed, e.g., .PROC, .ENDPROC, .SCOPE, .ENDSCOPE, .SEGMENT, .FEATURE
};

const registers = ["A", "X", "Y"];

export function configure6502Language(monaco: typeof Monaco) {
    const languageId = "6502asm";

    monaco.languages.register({ id: languageId });

    // --- Monarch Tokenizer ---
    monaco.languages.setMonarchTokensProvider(languageId, {
        // Set defaultToken to invalid to see errors clearly
        defaultToken: 'invalid',
        ignoreCase: true,
        registers: registers,
        instructions: Object.keys(instructionSet),
        directives: Object.keys(directives).map(d => d.startsWith('.') ? '\\' + d : d), // Escape dot for regex if needed
        symbols: /[=><!~?:&|+\-*/^%]+/, // Operators
        escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,

        tokenizer: {
            root: [
                // Identifiers and Keywords
                [/[a-z_]\w*/, {
                    cases: {
                        '@instructions': 'keyword.instruction',
                        '@registers': 'variable.register',
                        '@directives': 'keyword.directive',
                        '@default': 'identifier' // Could be variable, constant, or undefined label
                    }
                }],

                // Labels: identifier at the beginning of a line followed by a colon
                [/^\s*([a-zA-Z_]\w*):/, 'identifier.label'],

                // Whitespace
                { include: '@whitespace' },

                // Delimiters and Operators for addressing modes etc.
                [/[()\[\]]/, '@brackets'], // Parentheses for indirect modes
                [/@symbols/, { cases: { '=': 'keyword.operator', '@default': 'operator' } }], // Highlight '=' used for assignment differently
                [/#/, 'operator.immediate'], // Immediate addressing
                [/,/, 'operator.separator'], // Separator for indexed modes, lists

                // Numbers
                [/\$[0-9a-fA-F]{1,4}\b/, 'number.hex'], // Hexadecimal (1-4 digits typical for 16-bit addresses/data)
                [/%[01]{1,16}\b/, 'number.binary'], // Binary (1-16 digits)
                [/\d+\b/, 'number'], // Decimal

                // Strings
                [/"([^"\\]|\\.)*$/, 'string.invalid'], // Unterminated string
                [/"/, 'string', '@string_double'],
                [/'([^'\\]|\\.)*$/, 'string.invalid'], // Unterminated string
                [/'/, 'string', '@string_single'],
            ],

            whitespace: [
                [/[ \t\r\n]+/, ''], // Use 'white' token if you want to see whitespace highlighted
                [/;.*$/, 'comment'],
            ],

            comment: [
                // Comments are handled in whitespace rule, but could be expanded if needed
                // Example: multi-line comments if supported by a specific assembler
            ],

            string_double: [
                [/[^\\"]+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/"/, 'string', '@pop']
            ],

            string_single: [
                [/[^\\']+/, 'string'],
                [/@escapes/, 'string.escape'],
                [/\\./, 'string.escape.invalid'],
                [/'/, 'string', '@pop']
            ],
        },
    });

    // --- Completion Item Provider ---
    monaco.languages.registerCompletionItemProvider(languageId, {
        provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            const suggestions: Monaco.languages.CompletionItem[] = [];

            // Instruction suggestions
            for (const instr in instructionSet) {
                suggestions.push({
                    label: instr,
                    kind: monaco.languages.CompletionItemKind.Keyword,
                    insertText: instr,
                    range: range,
                    detail: instructionSet[instr].modes,
                    documentation: instructionSet[instr].desc,
                });
            }

            // Directive suggestions
            for (const dir in directives) {
                suggestions.push({
                    label: dir,
                    kind: monaco.languages.CompletionItemKind.Keyword, // Or Snippet if it has one
                    insertText: directives[dir].snippet || dir, // Use snippet if available
                    insertTextRules: directives[dir].snippet ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
                    range: range,
                    documentation: directives[dir].desc,
                });
            }

            // Register suggestions
            registers.forEach(reg => {
                suggestions.push({
                    label: reg,
                    kind: monaco.languages.CompletionItemKind.Variable,
                    insertText: reg,
                    range: range,
                    detail: "CPU Register"
                });
            });

            // Snippets for common routines
            const snippets: Monaco.languages.CompletionItem[] = [
                {
                    label: "if/else (branch)",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: [
                        "; If condition (e.g., CMP #value)",
                        "${1:condition_setup_instruction}", // e.g., CMP #10
                        "${2:branch_if_false_instruction} ELSE_LABEL", // e.g., BNE ELSE_LABEL
                        "\t; Code for IF block",
                        "\t${3:if_block_code}",
                        "\tJMP ENDIF_LABEL",
                        "ELSE_LABEL:",
                        "\t; Code for ELSE block",
                        "\t${4:else_block_code}",
                        "ENDIF_LABEL:",
                        "\t; Continue after if/else",
                    ].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: "Basic IF/ELSE structure using branching",
                    range: range,
                },
                {
                    label: "for loop (decrement)",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: [
                        "\tLDX #${1:count} ; Initialize loop counter (use X or Y)",
                        "LOOP_START:",
                        "\t; Loop body code",
                        "\t${2:loop_body_code}",
                        "",
                        "\tDEX ; Decrement counter",
                        "\tBNE LOOP_START ; Branch if counter not zero",
                        "; End of loop",
                    ].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: "Basic FOR loop using DEX/BNE",
                    range: range,
                },
                {
                    label: "for loop (increment)",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: [
                        "\tLDX #0 ; Initialize loop counter (use X or Y)",
                        "LOOP_START:",
                        "\t; Loop body code using X",
                        "\t${1:loop_body_code}",
                        "",
                        "\tINX ; Increment counter",
                        "\tCPX #${2:end_count} ; Compare with end value + 1",
                        "\tBNE LOOP_START ; Branch if not finished",
                        "; End of loop",
                    ].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: "Basic FOR loop using INX/CPX/BNE",
                    range: range,
                },
                {
                    label: "Basic Program Structure",
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    insertText: [
                        "\t; Define constants",
                        "SCREEN_MEM = \\$0400",
                        "",
                        "\t; Set program origin",
                        "\t* = \\$C000 ; Or use ORG directive",
                        "",
                        "START:",
                        "\t; Main program code",
                        "\t${1:program_code}",
                        "",
                        "\t; Infinite loop or exit",
                        "LOOP:",
                        "\tJMP LOOP ; Or RTS if called via JSR",
                        "",
                        "; Subroutines (if any)",
                        "${2:subroutines}",
                        "",
                        "; Data (if any)",
                        "${3:data}",
                    ].join('\n'),
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: "Basic structure for a simple program",
                    range: range,
                },
                // Add more snippets: delay loop, memory copy, string print, etc.
            ];

            // Combine all suggestions
            return { suggestions: suggestions.concat(snippets) };
        },
    });

    // --- Hover Provider ---
    monaco.languages.registerHoverProvider(languageId, {
        provideHover: (model, position) => {
            const wordInfo = model.getWordAtPosition(position);
            if (!wordInfo) {
                return null;
            }
            const word = wordInfo.word.toUpperCase(); // Match case-insensitively

            // Check Instructions
            if (instructionSet[word]) {
                const instr = instructionSet[word];
                return {
                    range: new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn),
                    contents: [
                        { value: `**${word}**` },
                        { value: `*${instr.desc}*` },
                        { value: `Addressing Modes: ${instr.modes}` },
                        // Could add flags affected, cycle counts here if desired
                    ]
                };
            }

            // Check Directives
            // Need to handle case where directive starts with '.' or is '='
            const directiveKey = Object.keys(directives).find(k => k.toUpperCase() === word);
            if (directiveKey && directives[directiveKey]) {
                const dir = directives[directiveKey];
                return {
                    range: new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn),
                    contents: [
                        { value: `**${directiveKey}** (Directive)` },
                        { value: dir.desc },
                    ]
                };
            }

            // Check Registers
            if (registers.map(r => r.toUpperCase()).includes(word)) {
                return {
                    range: new monaco.Range(position.lineNumber, wordInfo.startColumn, position.lineNumber, wordInfo.endColumn),
                    contents: [
                        { value: `**${word}** (Register)` },
                        { value: `8-bit CPU Register (${word === 'A' ? 'Accumulator' : (word === 'X' ? 'Index X' : 'Index Y')})` },
                    ]
                };
            }

            // Could add hover for labels/variables if you implement symbol tracking
            // (Requires more advanced parsing beyond static configuration)

            return null; // No hover information for this word
        }
    });

    // --- Basic Language Configuration ---
    monaco.languages.setLanguageConfiguration(languageId, {
        comments: {
            lineComment: ';',
        },
        brackets: [
            ['(', ')'],
            ['[', ']'], // Less common in 6502, but some assemblers might use them
        ],
        autoClosingPairs: [
            { open: '(', close: ')' },
            { open: '[', close: ']' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
        ],
        surroundingPairs: [
            { open: '(', close: ')' },
            { open: '[', close: ']' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
        ],
        // Indentation rules are tricky for assembly. Basic rules:
        // Indent after a label, no real outdent rule is reliable.
        // Let's keep it simple or rely on auto-indent features.
        // indentationRules: {
        //     increaseIndentPattern: /^\s*[a-zA-Z_]\w*:/, // Indent lines following a label
        //     // decreaseIndentPattern: // Hard to define reliably for assembly
        // },
        // Define what constitutes a 'word' in this language
        // Include characters often part of symbols/numbers
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
    });

    // --- Basic Syntax Linting (via Monarch's defaultToken: 'invalid') ---
    // The Monarch tokenizer already marks unrecognized tokens as 'invalid'.
    // This provides a basic level of syntax error highlighting for things
    // that don't match any defined rule (like misplaced characters).
    // More advanced linting (e.g., checking operand validity for instructions)
    // would require integrating an actual assembler or parser.

    console.log("6502 Assembly language configuration loaded.");
}

// --- How to use it ---
// Assuming you have 'monaco' imported in your project:
//
// import * as monaco from 'monaco-editor';
// import { configure6502Language } from './path/to/this/file';
//
// // Before creating the editor instance:
// configure6502Language(monaco);
//
// // Now create the editor
// monaco.editor.create(document.getElementById('container'), {
//     value: '; Example 6502 Code\nSTART:\n  LDA #$01\n  STA $0400\nLOOP:\n  JMP LOOP',
//     language: '6502asm',
//     theme: 'vs-dark' // Or your preferred theme
// });