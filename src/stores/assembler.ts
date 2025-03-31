import { defineStore } from "pinia";
import { assemble } from "../libs/asm6502.js"; // Import the assemble function directly

interface AssemblerState {
  code: string;
  output: string;
  hexBytes: number[];
  startAddress: number; // Add this
}

export const useAssemblerStore = defineStore("assembler", {
  state: (): AssemblerState => ({
    code: `; Hello World program for 6502
    
.org $8000          ; program starting address

ser_out_addr = $fff1    ; serial output address

reset:
ldx #$0             ; initialize character counter
lda test_str,x      ; load the first character (x=0)

main:               ; iterate through the string
sta ser_out_addr    ; print the character just loaded
inx                 ; increase x by 1
lda test_str,x      ; load the next character
beq reset           ; if character == /0, jump to reset
jmp main            ; else jump to main

test_str: 
    .byte "Hello world!", $0d, $0a, $0  ; "Hello world!/r/n/0"
`,
    output: "Ready to assemble.",
    hexBytes: [],
    startAddress: 0x8000, // Default start address
  }),
  actions: {
    assembleCode() {
      try {
        // Parse .org directive if present
        const orgMatch = this.code.match(/\.org\s+\$([0-9A-Fa-f]{1,4})/);
        this.startAddress = orgMatch ? parseInt(orgMatch[1], 16) : 0x8000;

        const result = assemble(this.code);
        this.hexBytes = result.bytecode; // Use bytecode property from result
        console.log(this.hexBytes)
        this.hexBytes.forEach((byte, index) => { console.log(`Index: ${index}, Byte: ${byte}`); });
        const hexString = this.hexBytes
          .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
          .join(" ");
        this.output = `Assembly successful!\nStart Address: $${this.startAddress
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")}\nBytes: ${this.hexBytes.length
          }\n\nHex Output:\n${hexString}`;

        if (result.labels) {
          this.output += "\n\nLabels:";
          for (const [label, address] of Object.entries(result.labels)) {
            this.output += `\n${label}: $${address
              .toString(16)
              .toUpperCase()
              .padStart(4, "0")}`;
          }
        }

        console.log("Compiled Bytes:", this.hexBytes);
      } catch (e) {
        this.hexBytes = [];
        if (e instanceof Error) {
          this.output = `Assembly Error: ${e.message}`;
        } else {
          this.output = `An unknown error occurred during assembly.`;
        }
        console.error("Assembly failed:", e);
      }
    },
    setCode(newCode: string) {
      this.code = newCode;
    },
  },
  persist: {
    paths: ["code"],
  },
});
