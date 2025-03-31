<template>
  <div class="assembler-container">
    <h2>6502 Assembler</h2>
    <div ref="editorContainer" class="editor-container"></div>
    <button @click="handleAssemble">Assemble</button>
    <div class="output-area">
      <h3>Output:</h3>
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
// TODO:
// - add more directive in compiler
// - add more common routines such as print to terminal, toggle pixels, etc.
// - add line numbers in compiler warnings
// - example code snippets
// - save to local file / load from local file
// - syntax error highlighting?
// - clear terminal output
// - visual widgets for interfacing the emulator

import { ref, onMounted, onBeforeUnmount } from "vue";
import { useAssemblerStore } from "../stores/assembler";
import { storeToRefs } from "pinia";
import loader from "@monaco-editor/loader";
import { configure6502Language } from "../utils/6502-monaco-config";

const assemblerStore = useAssemblerStore();
const { output } = storeToRefs(assemblerStore);
const editorContainer = ref<HTMLElement | null>(null);
let editor: any = null;

const updateEditorLayout = () => {
  if (editor) {
    editor.layout();
  }
};

onMounted(async () => {
  if (!editorContainer.value) return;

  const monaco = await loader.init();
  configure6502Language(monaco);

  editor = monaco.editor.create(editorContainer.value, {
    value: assemblerStore.code,
    language: "6502asm",
    theme: "vs",
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    lineNumbers: "on",
    fontSize: 14,
    fontFamily: '"Courier New", Courier, monospace',
  });

  editor.onDidChangeModelContent(() => {
    assemblerStore.setCode(editor.getValue());
  });

  window.addEventListener("resize", updateEditorLayout);
});

onBeforeUnmount(() => {
  if (editor) {
    editor.dispose();
  }
  window.removeEventListener("resize", updateEditorLayout);
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

.editor-container {
  flex: 1;
  min-height: 300px;
  border: 1px solid #ccc;
  border-radius: 3px;
}

textarea {
  display: none;
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
