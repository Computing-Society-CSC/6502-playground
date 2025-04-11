<template>
  <div class="debugger-controls">
    <h3>Debugger Controls</h3>

    <!-- Execution Controls -->
    <div class="control-section">
      <h4>Execution</h4>
      <div class="control-group">
        <button
          @click="sendCommand('s')"
          :disabled="!isConnected"
          title="Switch to single-step mode or step once"
          class="btn-primary"
        >
          Step
        </button>
        <button
          @click="sendCommand('c')"
          :disabled="!isConnected"
          title="Continue automatic execution"
          class="btn-primary"
        >
          Run
        </button>
      </div>
    </div>

    <!-- Frequency Control -->
    <div class="control-section">
      <h4>Clock Frequency</h4>
      <div class="input-group">
        <input
          v-model="frequency"
          type="number"
          min="0"
          placeholder="Frequency (Hz)"
          :disabled="!isConnected"
        />
        <button
          @click="setFrequency"
          :disabled="!isConnected"
          title="Set execution frequency"
          class="btn-secondary"
        >
          Set
        </button>
      </div>
      <div class="hint">0 = maximum speed</div>
    </div>

    <!-- Memory Operations -->
    <div class="control-section">
      <h4>Memory Operations</h4>

      <!-- Memory Write -->
      <div class="input-group">
        <input
          v-model="memoryWriteAddr"
          type="text"
          placeholder="Start address (hex)"
          :disabled="!isConnected"
        />
        <input
          v-model="memoryWriteData"
          type="text"
          placeholder="Data bytes (hex, comma-separated)"
          :disabled="!isConnected"
        />
        <button
          @click="writeMemory"
          :disabled="!isConnected || !memoryWriteAddr || !memoryWriteData"
          title="Write data to memory"
          class="btn-secondary"
        >
          Write
        </button>
      </div>
      <div class="hint">Format: address = XXXX, data = XX,XX,XX</div>

      <!-- Memory Read -->
      <div class="input-group">
        <input
          v-model="memoryReadAddr"
          type="text"
          placeholder="Start address (hex)"
          :disabled="!isConnected"
        />
        <input
          v-model="memoryReadLength"
          type="number"
          min="1"
          max="65536"
          placeholder="Length"
          :disabled="!isConnected"
        />
        <button
          @click="readMemory"
          :disabled="!isConnected || !memoryReadAddr || !memoryReadLength"
          title="Read memory contents"
          class="btn-secondary"
        >
          Read
        </button>
      </div>
    </div>

    <!-- Misc Controls -->
    <div class="control-section">
      <h4>Misc</h4>
      <div class="control-group">
        <button
          @click="sendCommand('l')"
          :disabled="!isConnected"
          title="Toggle debug logging"
          class="btn-secondary"
        >
          Toggle Logging
        </button>
        <button
          @click="confirmResetRAM"
          :disabled="!isConnected"
          title="Reset RAM (requires device reset)"
          class="btn-danger"
        >
          Reset RAM
        </button>
      </div>
    </div>

    <!-- Confirmation Dialog -->
    <div v-if="showConfirmDialog" class="confirm-dialog">
      <div class="confirm-content">
        <p>Are you sure you want to reset RAM? This will require a device reset.</p>
        <div class="confirm-buttons">
          <button @click="resetRAM" class="btn-danger">Yes, Reset</button>
          <button @click="showConfirmDialog = false" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, inject } from "vue";
import { useSerialStore } from "../stores/serial";
import { storeToRefs } from "pinia";

// Get the serial store and connection state
const serialStore = useSerialStore();
const { isConnected } = storeToRefs(serialStore);

// Inject the send function from parent component
const sendSerialData = inject("sendSerialData") as
  | ((data: string) => Promise<void>)
  | undefined;

// Form state
const frequency = ref<number | null>(null);
const memoryWriteAddr = ref("");
const memoryWriteData = ref("");
const memoryReadAddr = ref("");
const memoryReadLength = ref<number | null>(null);
const showConfirmDialog = ref(false);

// Helper function to validate hex
const isValidHex = (value: string): boolean => /^[0-9A-Fa-f]+$/.test(value);

// Send a simple command
const sendCommand = async (cmd: string) => {
  if (!sendSerialData) {
    console.error("sendSerialData function not provided by parent");
    return;
  }
  await sendSerialData(cmd);
};

// Set clock frequency
const setFrequency = async () => {
  if (!sendSerialData) return;
  if (frequency.value === null) {
    // null defaults to 0
    await sendSerialData(`f0\n`);
    return;
  }

  await sendSerialData(`f${frequency.value}\n`);
};

// Write data to memory
const writeMemory = async () => {
  if (!memoryWriteAddr.value || !memoryWriteData.value || !sendSerialData) return;

  // Validate address
  if (!isValidHex(memoryWriteAddr.value)) {
    alert("Address must be a valid hexadecimal value");
    return;
  }

  // Validate data bytes
  const dataBytes = memoryWriteData.value.split(",");
  for (const byte of dataBytes) {
    if (!isValidHex(byte.trim())) {
      alert("Data bytes must be valid hexadecimal values");
      return;
    }
  }

  // Format: d<address>,<byte1>,<byte2>,...
  const command = `d${memoryWriteAddr.value},${memoryWriteData.value}\n`;
  await sendSerialData(command);
};

// Read memory
const readMemory = async () => {
  if (!memoryReadAddr.value || !memoryReadLength.value || !sendSerialData) return;

  // Validate address
  if (!isValidHex(memoryReadAddr.value)) {
    alert("Address must be a valid hexadecimal value");
    return;
  }

  // Format: r<address>,<length>
  const command = `r${memoryReadAddr.value},${memoryReadLength.value}\n`;
  await sendSerialData(command);
};

// Confirm RAM reset
const confirmResetRAM = () => {
  showConfirmDialog.value = true;
};

// Reset RAM
const resetRAM = async () => {
  if (!sendSerialData) return;

  await sendSerialData("n\n");
  showConfirmDialog.value = false;
};
</script>

<style scoped>
.debugger-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  position: relative;
}

h3 {
  margin: 0 0 12px 0;
  font-size: 1.2rem;
}

h4 {
  margin: 0 0 8px 0;
  font-size: 1rem;
  color: #555;
}

.control-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.input-group {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.input-group input {
  flex: 1;
  min-width: 120px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

button {
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0069d9;
}

.btn-secondary {
  background-color: #6c757d;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-danger {
  background-color: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #c82333;
}

.hint {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: -4px;
}

.confirm-dialog {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.confirm-content {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  max-width: 400px;
  width: 100%;
}

.confirm-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 600px) {
  .input-group {
    flex-direction: column;
  }

  .input-group input {
    width: 100%;
  }
}
</style>
