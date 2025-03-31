import { defineStore } from 'pinia';

interface SerialState {
    isConnected: boolean;
    portInfo: string | null;
    lastError: string | null;
}

export const useSerialStore = defineStore('serial', {
    state: (): SerialState => ({
        isConnected: false,
        portInfo: null,
        lastError: null,
    }),
    actions: {
        setConnected(status: boolean, portDetails: string | null = null) {
            this.isConnected = status;
            this.portInfo = status ? portDetails : null;
            if (!status) {
                // Optionally clear error when disconnecting successfully
                // this.lastError = null;
            }
        },
        setError(errorMessage: string | null) {
            this.lastError = errorMessage;
            // Also set connected to false if an error occurs during connection/operation
            if (errorMessage) {
                this.isConnected = false;
                this.portInfo = null;
            }
        },
    },
    // No persistence needed for serial connection state generally
});