<template>
  <div class="serial-container">
    <h2>Serial Terminal</h2>

    <!-- Simple mode toggle -->
    <div class="mode-toggle">
      <button @click="showDebugger = !showDebugger" class="toggle-btn">
        {{ showDebugger ? "Hide Debugger Controls" : "Show Debugger Controls" }}
      </button>
    </div>

    <!-- Debugger Controls (when showDebugger is true) -->
    <DebuggerControls v-if="showDebugger" />

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
import { ref, onMounted, onBeforeUnmount, watch, computed, provide } from "vue";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { useSerialStore } from "../stores/serial";
import { useAssemblerStore } from "../stores/assembler";
import { storeToRefs } from "pinia";
import DebuggerControls from "./DebuggerControls.vue";

// --- Pinia Stores ---
const serialStore = useSerialStore();
const assemblerStore = useAssemblerStore();
const { isConnected, portInfo, lastError } = storeToRefs(serialStore);
const { hexBytes } = storeToRefs(assemblerStore);

// --- UI State ---
const showDebugger = ref(true);

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

// --- Provide send function for DebuggerControls ---
// Creates a function that the child DebuggerControls component can use to send data
const sendSerialData = async (data: string): Promise<void> => {
  if (!isConnected.value || !writer) {
    term?.writeln("\r\n[Not connected]");
    return;
  }

  try {
    const encoder = new TextEncoder();
    await writer.write(encoder.encode(data));
    // Don't echo commands to the terminal - the response will show up on its own
  } catch (error) {
    handleSerialError("Error sending command", error);
  }
};

// Provide this function to child components
provide("sendSerialData", sendSerialData);

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
    port = await navigator.serial.requestPort();

    term?.writeln("Opening port...");
    await port.open({ baudRate: 9600 });

    const portDetails = port.getInfo();
    const portLabel = `VID: ${portDetails.usbVendorId?.toString(
      16
    )} PID: ${portDetails.usbProductId?.toString(16)}`;
    serialStore.setConnected(true, portLabel);
    term?.writeln(`\r\nConnected to ${portLabel}`);

    if (port.readable && port.writable) {
      writer = port.writable.getWriter();
      reader = port.readable.getReader();
      keepReading = true;
      readLoop();
    } else {
      throw new Error("Port is not readable or writable");
    }
  } catch (error) {
    handleSerialError("Failed to connect", error);
    await disconnect();
  }
};

const disconnect = async () => {
  keepReading = false;

  if (reader) {
    try {
      await reader.cancel();
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.warn("Error cancelling reader:", error);
      }
    } finally {
      reader = null;
    }
  }

  if (writer) {
    try {
      await writer.close().catch((e) => console.warn("Error closing writer:", e));
    } catch (error) {
      console.warn("Error closing writer:", error);
    } finally {
      writer = null;
    }
  }

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

  serialStore.setConnected(false);
};

const readLoop = async () => {
  if (!reader || !term) return;

  term.writeln("[Read loop started]");

  while (port?.readable && keepReading) {
    try {
      const { value, done } = await reader.read();

      if (done) {
        term.writeln("[Read loop finished: done]");
        break;
      }

      if (value) {
        term.write(value);
      }
    } catch (error) {
      if (keepReading) {
        handleSerialError("Error reading data", error);
        await disconnect();
      } else {
        term.writeln("[Read loop finished: cancelled]");
      }
      break;
    }
  }

  try {
    reader?.releaseLock();
  } catch (e) {}
  reader = null;
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

const sendCompiledBytes = async () => {
  if (!isConnected.value || !writer || hexBytes.value.length === 0) {
    term?.writeln("\r\n[Cannot send: Not connected or no compiled bytes available]");
    return;
  }

  try {
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

watch(isConnected, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    console.log(`Connection state changed: ${newVal}`);
    setTimeout(() => fitAddon?.fit(), 50);
  }
});
</script>

<style scoped>
.serial-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

h2 {
  margin: 0 0 10px 0;
}

.mode-toggle {
  margin-bottom: 10px;
}

.toggle-btn {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 3px;
  padding: 6px 12px;
  cursor: pointer;
}

.toggle-btn:hover {
  background-color: #5a6268;
}

.terminal-wrapper {
  flex: 1;
  min-height: 0;
  background-color: #000;
  border-radius: 4px;
  padding: 4px;
  margin-bottom: 10px;
}

.terminal-wrapper > div {
  height: 100%;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
  color: #dc3545;
  font-weight: bold;
}
</style>
