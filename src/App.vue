<template>
  <div id="main-container">
    <h1>6502 Assembler & Serial Terminal</h1>
    <div class="tools-wrapper">
      <AssemblerComponent class="tool-panel" />
      <SerialTerminal class="tool-panel" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AssemblerComponent from "./components/AssemblerComponent.vue";
import SerialTerminal from "./components/SerialTerminal.vue";
</script>

<style>
/* Global styles if needed */
body {
  font-family: sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f0f0f0;
  min-height: 100vh;
}

#app {
  height: 100vh;
  padding: 10px;
}

/* App specific styles */
#main-container {
  height: calc(100vh - 20px);
  margin: 0 auto;
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

h1 {
  text-align: center;
  color: #333;
  margin: 0 0 10px 0;
}

.info {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  color: #856404;
  padding: 8px 15px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 0.9em;
}

.tools-wrapper {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0; /* Important for proper flex behavior */
}

.tool-panel {
  flex: 1;
  min-width: 0; /* Important for proper flex behavior */
  display: flex;
}

/* Remove media queries as we want consistent side-by-side layout */
</style>
