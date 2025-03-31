<template>
  <div class="serial-container">
    <h2>Serial Terminal</h2>
    <div class="terminal-wrapper">
      <div ref="terminalContainer"></div>
    </div>
    <div class="controls">
      <div class="status-bar">
        <span v-if="!isSerialSupported" class="error-text">
          Web Serial API not supported in this browser.
        </span>
        <span v-if="isConnected" class="status-text">
          Connected to: {{ portInfo || "Unknown Port" }}
        </span>
        <span v-if="lastError" class="error-text"> Error: {{ lastError }} </span>
      </div>
      <div class="buttons">
        <button @click="toggleConnection" :disabled="!isSerialSupported">
          {{ isConnected ? "Disconnect" : "Connect" }}
        </button>
        <button
          @click="sendCompiledBytes"
          :disabled="!isConnected || hexBytes.length === 0"
          title="Send compiled bytes from assembler"
        >
          Send Compiled Bytes
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from "vue";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useSerialStore } from "../stores/serial";
import { useAssemblerStore } from "../stores/assembler"; // Import assembler store
import { storeToRefs } from "pinia";

// --- Pinia Stores ---
const serialStore = useSerialStore();
const assemblerStore = useAssemblerStore(); // Get assembler store instance
const { isConnected, portInfo, lastError } = storeToRefs(serialStore);
const { hexBytes } = storeToRefs(assemblerStore); // Get compiled bytes

// --- Refs ---
const terminalContainer = ref<HTMLElement | null>(null);

// --- Terminal State ---
let term: Terminal | null = null;
let fitAddon: FitAddon | null = null;

// --- Web Serial State ---
let port: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
const isSerialSupported = computed(() => "serial" in navigator);
let keepReading = false; // Flag to control the read loop

// --- Lifecycle Hooks ---
onMounted(() => {
  if (terminalContainer.value) {
    initializeTerminal();
    window.addEventListener("resize", handleResize);
  } else {
    console.error("Terminal container not found");
  }
});

onBeforeUnmount(async () => {
  window.removeEventListener("resize", handleResize);
  await disconnect(); // Ensure disconnection on component unmount
  term?.dispose();
});

// --- Terminal Initialization ---
const initializeTerminal = () => {
  term = new Terminal({
    cursorBlink: true,
    convertEol: true, // Convert \n to \r\n
    rows: 20, // Default rows
  });
  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);

  if (terminalContainer.value) {
    term.open(terminalContainer.value);
    try {
      fitAddon.fit();
    } catch (e) {
      console.warn("FitAddon fit error on init:", e);
    }
    term.writeln("Welcome to the Vue Serial Terminal!");
    term.writeln('Click "Connect" to select a serial port.');

    // Handle data typed into the terminal
    term.onData(async (data: string) => {
      if (isConnected.value && writer) {
        try {
          const encoder = new TextEncoder();
          await writer.write(encoder.encode(data));
        } catch (error) {
          handleSerialError("Error writing data", error);
          await disconnect();
        }
      } else if (!isConnected.value) {
        term?.writeln("\r\n[Not Connected]");
      }
    });
  } else {
    console.error("Cannot open terminal, container not ready.");
  }
};

const handleResize = () => {
  try {
    fitAddon?.fit();
  } catch (e) {
    console.warn("FitAddon fit error on resize:", e);
  }
};

// --- Web Serial Logic ---
const toggleConnection = async () => {
  if (isConnected.value) {
    await disconnect();
  } else {
    await connect();
  }
};

const connect = async () => {
  if (!isSerialSupported.value) {
    serialStore.setError("Web Serial API not available.");
    term?.writeln("\r\nError: Web Serial API not supported by this browser.");
    return;
  }

  serialStore.setError(null); // Clear previous errors

  try {
    term?.writeln("\r\nRequesting serial port...");
    // Filter for common Arduino/microcontroller VID/PIDs - optional but helpful
    // You might need to adjust these or remove the filter
    // const usbVendorId = 0x2341; // Example: Arduino Uno VID
    port = await navigator.serial.requestPort({
      // filters: [{ usbVendorId }]
    });

    term?.writeln("Opening port...");
    // Common baud rate, adjust if needed
    await port.open({ baudRate: 9600 });

    const portDetails = port.getInfo();
    const portLabel = `VID: ${portDetails.usbVendorId?.toString(
      16
    )} PID: ${portDetails.usbProductId?.toString(16)}`;
    serialStore.setConnected(true, portLabel);
    term?.writeln(`\r\nConnected to ${portLabel}`);

    // Setup reader and writer
    if (port.readable && port.writable) {
      writer = port.writable.getWriter();
      reader = port.readable.getReader();
      keepReading = true;
      readLoop(); // Start reading in the background
    } else {
      throw new Error("Port is not readable or writable");
    }
  } catch (error) {
    handleSerialError("Failed to connect", error);
    await disconnect(); // Clean up if connection failed mid-way
  }
};

const disconnect = async () => {
  keepReading = false; // Signal the read loop to stop

  // Cancel reader first
  if (reader) {
    try {
      await reader.cancel(); // This interrupts the read() promise
      // The releaseLock is often handled implicitly by cancel/port closure,
      // but explicit release can prevent issues in some scenarios.
      // reader.releaseLock(); // Be cautious with explicit releaseLock after cancel
    } catch (error) {
      // Ignore cancellation errors as they are expected
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.warn("Error cancelling reader:", error);
      }
    } finally {
      reader = null;
    }
  }

  // Close writer
  if (writer) {
    try {
      // Don't await close() indefinitely if the port might be stuck
      await writer.close().catch((e) => console.warn("Error closing writer:", e));
      // writer.releaseLock(); // Usually released by close()
    } catch (error) {
      console.warn("Error closing writer:", error);
    } finally {
      writer = null;
    }
  }

  // Close port
  if (port) {
    try {
      await port.close();
      term?.writeln("\r\nDisconnected.");
    } catch (error) {
      handleSerialError("Error closing port", error);
    } finally {
      port = null;
    }
  }

  // Update state only after cleanup attempts
  serialStore.setConnected(false);
  // Do not clear lastError on disconnect, user might want to see it
};

const readLoop = async () => {
  if (!reader || !term) return;

  term.writeln("[Read loop started]");

  while (port?.readable && keepReading) {
    try {
      const { value, done } = await reader.read();

      if (done) {
        // Reader has been cancelled or port closed
        term.writeln("[Read loop finished: done]");
        break;
      }

      if (value) {
        // Write received data directly to the terminal
        term.write(value);
      }
    } catch (error) {
      // If keepReading is false, it means disconnect was called, expected error
      if (keepReading) {
        handleSerialError("Error reading data", error);
        await disconnect(); // Disconnect on read error
      } else {
        term.writeln("[Read loop finished: cancelled]");
      }
      break; // Exit loop on error or cancellation
    }
  }
  // Ensure reader lock is released when loop exits, unless already handled by disconnect
  try {
    reader?.releaseLock();
  } catch (e) {
    // Ignore error if lock already released
  }
  reader = null; // Clear reader ref after loop finishes
  console.log("Read loop exited.");
};

const handleSerialError = (context: string, error: unknown) => {
  let message = `${context}: `;
  if (error instanceof Error) {
    message += error.message;
  } else {
    message += String(error);
  }
  console.error(message, error);
  serialStore.setError(message);
  term?.writeln(`\r\nError: ${message}`);
};

// --- Function to send compiled bytes ---
const sendCompiledBytes = async () => {
  if (!isConnected.value || !writer || hexBytes.value.length === 0) {
    term?.writeln("\r\n[Cannot send: Not connected or no compiled bytes available]");
    return;
  }

  try {
    // Create the command string in the format "d<START_ADDR>,<BYTE1>,<BYTE2>..."
    const startAddr = assemblerStore.startAddress;
    const bytesString = hexBytes.value
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join(",");
    const command = `d${startAddr.toString(16).toUpperCase()},${bytesString}\n`;

    term?.writeln(`\r\n[Sending command: ${command.trim()}]`);
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(command));
    term?.writeln("[Command Sent]");
  } catch (error) {
    handleSerialError("Error sending compiled bytes", error);
    await disconnect();
  }
};

// --- Watchers ---
// Optional: Watch connection state changes to update terminal UI
watch(isConnected, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    // You could add more specific messages here if needed
    console.log(`Connection state changed: ${newVal}`);
    // Refit terminal in case layout changes slightly
    setTimeout(() => fitAddon?.fit(), 50);
  }
});
</script>

<style scoped>
.serial-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #ccc;
  padding: 15px;
  border-radius: 5px;
  background-color: #f9f9f9;
  width: 100%;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-bar {
  flex: 1;
  min-height: 20px;
}

.buttons {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

button {
  padding: 8px 15px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
  transition: background-color 0.2s;
}

button:hover:not(:disabled) {
  background-color: #0056b3;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status-text {
  font-style: italic;
  color: #333;
}

.error-text {
  color: #dc3545; /* Red for errors */
  font-weight: bold;
}

.terminal-wrapper {
  flex: 1;
  min-height: 0;
  border: 1px solid #ccc;
  overflow: hidden;
  background-color: #000;
  padding: 5px;
}

h2 {
  margin-top: 0;
  margin-bottom: 10px;
}
</style>
