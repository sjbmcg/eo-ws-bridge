// state.js - Shared application state
import { PacketSequencer, SequenceStart } from 'eolib';

// Create a state object to hold all mutable state
const state = {
  // Network state
  socket: null,
  sequencer: new PacketSequencer(SequenceStart.zero()),
  clientEncryptionMultiple: 0,
  serverEncryptionMultiple: 0,
  playerId: 0,
  sessionId: 0,
  selectedCharacterId: 0,

  // Game state
  hasEnteredGame: false,
  mapLoaded: false,
  playerPosition: { x: 0, y: 0, mapId: 0, direction: 0 },
  nearbyPlayers: {},
  pingInterval: null,
  attackCount: 0,
  lastAttackTime: 0,
  lastWalkTime: 0,

  // UI state references
  logContainer: null,

  // Reset application state
  reset() {
    this.mapLoaded = false;
    this.hasEnteredGame = false;
    this.nearbyPlayers = {};
    this.playerPosition = { x: 0, y: 0, mapId: 0, direction: 0 };
    this.attackCount = 0;
    this.lastAttackTime = 0;

    this.sequencer = new PacketSequencer(SequenceStart.zero());
  },

  // Set log container reference
  setLogContainer(container) {
    this.logContainer = container;
  },
};

// Logging function
export function log(msg) {
  if (!state.logContainer) {
    console.log('Log container not set:', msg);
    return;
  }

  const entry = document.createElement('div');
  entry.textContent = msg;
  state.logContainer.appendChild(entry);
  state.logContainer.scrollTop = state.logContainer.scrollHeight;
  console.log(msg);
}

export default state;
