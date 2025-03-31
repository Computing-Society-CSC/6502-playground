import { parse } from "./parser.js";
import { Opcodes } from "./opcodes.js";

let globalEnv = {};
export let labels = {};
let PC = 0;
let PCSet = false;
let enumSaveAdr = 0;
let pass = 1;

let localLabels = {};
let currentLabel = null;

function isSymbolDef(node) {
  return (
    Object.hasOwn(node, "expression") &&
    Object.hasOwn(node.expression, "operator") &&
    node.expression.operator === "="
  );
}

function isLabel(node) {
  return Object.hasOwn(node, "label");
}

function isInstruction(node) {
  return Object.hasOwn(node, "instruction");
}

function isDirective(node) {
  return Object.hasOwn(node, "directive");
}

function generateDirective(node) {
  switch (node.directive) {
    case ".byte":
      let bytes = [];
      let totalBytesGenerated = 0; // Use a separate counter for PC increment
      for (var i = 0; i < node.args.length; i++) {
        const arg = node.args[i]; // Get the original argument from the parser node

        if (typeof arg === "string") {
          // It's a string. Is it a symbol/label or a string literal?
          // Try resolving it first.
          const resolvedValue = resolveArg(arg);

          // If resolveArg returns the original string, it's likely a literal
          // or an unresolved symbol. We'll assume literals for .byte here.
          // A more robust parser would explicitly tag literals vs symbols.
          if (resolvedValue === arg) {
            // Assume it's a string literal. Iterate through its characters.
            // Basic quote stripping (if parser includes them - adjust if needed)
            let literalContent = arg;
            if (literalContent.length >= 2 && ((literalContent.startsWith('"') && literalContent.endsWith('"')) || (literalContent.startsWith("'") && literalContent.endsWith("'")))) {
               literalContent = literalContent.substring(1, literalContent.length - 1);
            }

            for (let j = 0; j < literalContent.length; j++) {
              bytes.push(literalContent.charCodeAt(j)); // Push ASCII code
              totalBytesGenerated++;
            }
          } else if (typeof resolvedValue === 'number') {
             // It was a symbol/label that resolved to a number
             bytes.push(resolvedValue & 0xFF); // Ensure it's a byte
             totalBytesGenerated++;
          } else {
             // Unresolved symbol/label in pass 2, or other issue
             bytes.push(null); // Keep null placeholder for unresolved symbols
             totalBytesGenerated++;
          }

        } else {
          // Argument is likely a number or an expression object
          const val = resolveArg(arg); // Resolve numbers, expressions
          if (typeof val === 'number') {
               bytes.push(val & 0xFF); // Ensure it's a byte
               totalBytesGenerated++;
          } else {
              // Unresolved expression or other non-numeric result
              bytes.push(null);
              totalBytesGenerated++;
          }
        }
      }
      PC += totalBytesGenerated; // Update PC based on actual bytes generated
      return bytes;
    case ".word":
      let words = [];
      for (var i = 0; i < node.args.length; i++) {
        const val = resolveArg(node.args[i]);
        if (typeof val === "string") {
          words.push(null, null);
        } else {
          words.push(val & 0xff, (val >> 8) & 0xff);
        }
      }

      PC += node.args.length * 2;
      return words;
    case ".enum":
      enumSaveAdr = PC;
      PC = node.args[0];
      break;
    case ".org":
      if (PCSet === false) {
        PC = node.args[0];
        PCSet = true;
        break;
      } else {
        const currentPC = PC;
        PC = node.args[0];
        //console.log(node.args[0])
        //console.log(new Array(node.args[0] - currentPC).fill(0))
        return new Array(node.args[0] - currentPC).fill(0);
      }
    case ".align":
      const padding = new Array((PC % node.args[0]) - PC).fill(0);
      PC += padding.length;
      return padding;
    case ".ende":
      PC = enumSaveAdr;
      break;
    case ".dsb":
      PC += node.args[0];
      break;
  }
}

function assignLabel(node) {
  if (pass == 1 && Object.hasOwn(labels, node.label)) {
    throw new Error("Duplicate label: " + node.label);
  }
  labels[node.label] = PC;
}

function assignLocalLabel(node) {
  if (!Object.hasOwn(localLabels, currentLabel)) {
    localLabels[currentLabel] = {};
  }
  localLabels[currentLabel][node.label] = PC;
}

function isZeropage(instruction) {
  const value = resolveArg(instruction.arg);
  return value >= 0 && value < 256;
}

function isIndirectY(instruction) {
  return instruction.mode === "indirectY";
}

function isIndirectX(instruction) {
  return instruction.mode === "indirectX";
}

function isIndirect(instruction) {
  return instruction.mode === "indirect";
}

function isImmediate(instruction) {
  return instruction.mode === "immediate";
}

function isAbsolute(instruction) {
  if (instruction.mode === "indirect") {
    return false;
  }
  if (instruction.opcode.toUpperCase() === "JSR") {
    return true;
  }
  if (instruction.opcode.toUpperCase() === "JMP") {
    return true;
  }
  let val = resolveArg(instruction.arg);
  return typeof val === "number" && val > 255;
}

function isImplied(instruction) {
  const implied = new Set([
    "brk",
    "clc",
    "sec",
    "cli",
    "sei",
    "clv",
    "cld",
    "sed",
    "nop",
    "tax",
    "txa",
    "dex",
    "inx",
    "tay",
    "tya",
    "dey",
    "iny",
    "rti",
    "rts",
    "txs",
    "tsx",
    "pha",
    "pla",
    "php",
    "plp",
  ]);
  if (
    instruction.arg !== null &&
    instruction.opcode.toLowerCase() === "asl" &&
    instruction.arg.toLowerCase() === "a"
  ) {
    return true;
  }
  //return implied.has(instruction.opcode.toLowerCase())
  return instruction.arg === null;
}

function isBranch(instruction) {
  const branch = new Set([
    "bpl",
    "bmi",
    "bvc",
    "bvs",
    "bcc",
    "bcs",
    "bne",
    "beq",
  ]);
  return branch.has(instruction.opcode.toLowerCase());
}

function isIndexed(instruction) {
  if (instruction.arg === null) {
    return false;
  }
  return (
    Array.isArray(instruction.arg) &&
    (instruction.arg[1] === "x" || instruction.arg[1] === "y")
  );
}

function evaluateExpression(exp) {
  //console.log(exp)
  const left = resolveLabel(exp.expression.left);
  const right = resolveLabel(exp.expression.right);
  if (typeof left === "string" || typeof right === "string") {
    return exp;
  }
  if (exp.expression.operator === "+") {
    return left + right;
  }
  return exp;
}

function resolveArg(arg) {
  if (arg === null) {
    return null;
  }
  if (typeof arg === "string") {
    if (Object.hasOwn(globalEnv, arg)) {
      return globalEnv[arg];
    }
    return resolveLabel(arg);
  }
  if (typeof arg === "object" && !Array.isArray(arg)) {
    return (arg = evaluateExpression(arg));
  }
  if (typeof arg === "number") {
    return arg;
  }
}

function resolveLabel(arg) {
  if (arg[0] === "@" && localLabels[currentLabel]) {
    return typeof arg === "string" &&
      Object.hasOwn(localLabels[currentLabel], arg)
      ? localLabels[currentLabel][arg]
      : arg;
  } else {
    return typeof arg === "string" && Object.hasOwn(labels, arg)
      ? labels[arg]
      : arg;
  }
}

function generateInstruction(node) {
  //console.log(node)
  let mode, opcode, arg;
  arg = resolveArg(node.instruction.arg);
  //console.log(arg)
  //console.log(node.instruction.arg)
  if (isZeropage(node.instruction)) {
    mode = "zeropage";
  }
  if (isImmediate(node.instruction)) {
    mode = "immediate";
  }
  if (isIndexed(node.instruction)) {
    mode = "indexed";
  }
  if (isIndirect(node.instruction)) {
    mode = "indirect";
  }
  if (isAbsolute(node.instruction)) {
    mode = "absolute";
  }
  if (isIndirectY(node.instruction)) {
    mode = "indirectY";
  }
  if (isIndirectX(node.instruction)) {
    mode = "indirectX";
  }
  if (isImplied(node.instruction)) {
    mode = "implied";
  }
  if (isBranch(node.instruction)) {
    mode = "branch";
  }
  //console.log(node, "mode: " + mode)
  for (var o = 0; o < Opcodes.length; o++) {
    if (Opcodes[o][0] === node.instruction.opcode.toUpperCase()) {
      switch (mode) {
        case "immediate":
          opcode = Opcodes[o][1];
          arg = resolveArg(node.instruction.arg);
          PC += 2;
          return typeof arg === "string" ? node : [opcode, arg];
        case "zeropage":
          opcode = Opcodes[o][2];
          arg = resolveArg(node.instruction.arg);
          PC += 2;
          return [opcode, arg];
        case "absolute":
          opcode = Opcodes[o][5];
          arg = resolveArg(node.instruction.arg);
          //console.log(arg)
          PC += 3;
          // If label is unresolved, we can partially assemble it
          // because we know it is a 16-bit address.
          if (typeof arg === "string" || typeof arg === "object") {
            return [opcode, null, null];
          } else {
            return [opcode, arg & 0xff, (arg >> 8) & 0xff];
          }
        case "indexed":
          // We try to resolve the first arg and dispatch on the second
          //console.log(node.instruction.arg)
          const arg1 = resolveArg(node.instruction.arg[0]);
          const arg2 = node.instruction.arg[1];
          if (typeof arg1 === "string") {
            PC += 3;
            return node;
          } else {
            if (arg1 >= 0 && arg1 < 256) {
              // zero page x or y
              PC += 2;
              return [
                arg2 === "x" ? (Opcodes[o][3], arg1) : (Opcodes[o][4], arg1),
              ];
            } else {
              // absolute x or y
              PC += 3;
              if (arg2 === "x") {
                return [Opcodes[o][6], arg1 & 0xff, (arg1 >> 8) & 0xff];
              } else {
                //console.log(arg1)
                return [Opcodes[o][7], arg1 & 0xff, (arg1 >> 8) & 0xff];
              }
            }
          }
          break;
        case "indirect":
          PC += 3;
          arg = resolveArg(node.instruction.arg);
          const arg_lo = arg & 0xff;
          const arg_hi = (arg >> 8) & 0xff;
          return [Opcodes[o][8], arg_lo, arg_hi];
          break;
        case "indirectX":
          PC += 2;
          return [Opcodes[o][9], resolveArg(node.instruction.arg)];
          break;
        case "indirectY":
          //console.log(node.instruction.arg)
          PC += 2;
          return [Opcodes[o][10], resolveArg(node.instruction.arg)];
          break;
        case "implied":
          opcode = Opcodes[o][11];
          PC++;
          return [opcode];
        case "branch":
          opcode = Opcodes[o][12];
          arg = resolveArg(node.instruction.arg);
          PC++;
          let val;
          if (arg < PC) {
            // Backwards?
            val = (0xff - (PC - arg)) & 0xff;
          } else {
            val = (arg - PC - 1) & 0xff;
          }
          PC++;
          return [opcode, val];
        default:
          return node;
      }
    }
  }
}

// The global `labels` object will be modified,
// and the returned AST will have instructions
// converted to bytecode when possible
function process(code) {
  let result = [];
  for (var i = 0; i < code.length; i++) {
    if (isDirective(code[i])) {
      const output = generateDirective(code[i]);
      if (typeof output !== "undefined") {
        result.push(output);
      }
    }
    if (isSymbolDef(code[i])) {
      globalEnv[code[i].expression.left] = code[i].expression.right;
    }
    if (isLabel(code[i])) {
      if (code[i].label[0] === "@") {
        assignLocalLabel(code[i]);
      } else {
        assignLabel(code[i]);
        currentLabel = code[i].label;
      }
    }
    if (isInstruction(code[i])) {
      const instruction = generateInstruction(code[i]);
      //console.log(instruction)
      result.push(instruction);
    }
  }
  return result;
}

function gen1(code) {
  PC = 0;
  PCSet = false;
  const ast = parse(code);
  let result = [];
  for (var i = 0; i < ast.length; i++) {
    result.push(process(ast[i]));
  }
  return result;
}

function mesenLabels(labels, localLabels) {
  for (const scope in localLabels) {
    for (const label in localLabels[scope]) {
      if (Object.hasOwn(labels, label)) {
        labels["@" + scope + "_" + label.slice(1)] = localLabels[scope][label];
      } else {
        labels[label] = localLabels[scope][label];
      }
    }
  }
  let result = "";
  for (const label in labels) {
    if (labels[label] >= 0x8000) {
      const val = labels[label] - 0x8000;
      const adr = String(val.toString(16)).padStart(4, "0");
      result += "NesPrgRom:" + adr + ":" + label + "\n";
    } else {
      const val = labels[label];
      const adr = String(val.toString(16)).padStart(4, "0");
      result += "NesInternalRam:" + adr + ":" + label + "\n";
    }
  }
  return result;
}

export function generate(code) {
  labels = {};
  localLabels = {};
  currentLabel = null;
  pass = 1;
  gen1(code, 1);
  pass = 2;
  const bytecode = gen1(code, 2).flat(2);
  return {
    bytecode: bytecode,
    labels: labels,
    mesenLabels: mesenLabels(labels, localLabels)
  };
}
