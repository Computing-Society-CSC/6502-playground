import { defineStore } from "pinia";
import { assemble } from "asm6502"; // Import the assemble function directly

interface AssemblerState {
  code: string;
  output: string;
  hexBytes: number[];
  startAddress: number; // Add this
}

export const useAssemblerStore = defineStore("assembler", {
  state: (): AssemblerState => ({
    code: `; Simple 6502 Example
.org $8000    ; Set start address to $8000
; Load the value #$01 into the accumulator
LDA #$01
; Add the value #$02 to the accumulator
ADC #$02
; Store the result in memory location $00
STA $00
BRK ; Break instruction`,
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
