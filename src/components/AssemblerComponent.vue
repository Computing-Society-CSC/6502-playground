<template>
  <div class="assembler-container">
    <h2>6502 Assembler</h2>
    <textarea
      v-model="code"
      rows="15"
      placeholder="Enter 6502 Assembly Code Here..."
      spellcheck="false"
    ></textarea>
    <button @click="handleAssemble">Assemble</button>
    <div class="output-area">
      <h3>Output:</h3>
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useAssemblerStore } from "../stores/assembler";
import { storeToRefs } from "pinia";

const assemblerStore = useAssemblerStore();

// Use storeToRefs to keep reactivity when destructuring state/getters
// Use computed for direct state access or simple transformations if needed
const { output } = storeToRefs(assemblerStore);

// Use computed for v-model to use the action for setting
const code = computed({
  get: () => assemblerStore.code,
  set: (value) => assemblerStore.setCode(value),
});

const handleAssemble = () => {
  assemblerStore.assembleCode();
};
</script>

<style scoped>
.assembler-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid #ccc;
  padding: 15px;
  border-radius: 5px;
  background-color: #f9f9f9;
  width: 100%;
}

textarea {
  flex: 1;
  min-height: 0;
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
  border: 1px solid #ccc;
  padding: 5px;
  resize: none;
}

button {
  padding: 8px 15px;
  cursor: pointer;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 3px;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #45a049;
}

.output-area {
  margin-top: 10px;
  background-color: #eee;
  padding: 10px;
  border-radius: 3px;
  border: 1px solid #ddd;
  height: 100px; /* Reduced fixed height */
  overflow-y: auto;
}

pre {
  white-space: pre-wrap; /* Allow wrapping */
  word-wrap: break-word; /* Break long words */
  font-family: "Courier New", Courier, monospace;
  font-size: 0.9em;
  margin: 0;
}

h2,
h3 {
  margin-top: 0;
  margin-bottom: 10px;
}
</style>
