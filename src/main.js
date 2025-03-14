// main.js - Main entry point for the application
import { setupUI, registerSendWelcomeRequest } from './ui/ui.js';
import { 
  connectAndLogin, 
  sendAttack, 
  sendChat, 
  sendWalk,
  sendFace,
  sendWelcomeRequest 
} from './network/index.js';
import { Direction } from 'eolib';
import state, { log } from './core/state.js';

// Bootstraps application functionality
document.addEventListener("DOMContentLoaded", () => {
  registerSendWelcomeRequest(sendWelcomeRequest);
  
  const { 
    connectButton, 
    actionControls,
    chatInput
  } = setupUI();
  
  connectButton.addEventListener("click", connectAndLogin);
  
  document.getElementById("send-chat").addEventListener("click", () => {
    if (state.hasEnteredGame && chatInput.value) {
      sendChat(chatInput.value);
    }
  });
  
  document.getElementById("toggle-custom-sequence").addEventListener("change", (e) => {
    state.useCustomSequence = e.target.checked;
    log(`${state.useCustomSequence ? "Enabled" : "Disabled"} custom sequence handling`);
  });
  
  document.getElementById("reset-counter").addEventListener("click", () => {
    state.customSequenceCounter = 0;
    log("Custom sequence counter reset to 0");
  });
  
  document.addEventListener("keydown", (e) => {
    if (!state.hasEnteredGame) return;

    if (e.key === "Enter") {
      if (chatInput && chatInput.value) {
        sendChat(chatInput.value);
        chatInput.value = '';
      }
      return;
    }
    
    let direction = null;
    
    let isAttackKey = e.ctrlKey;
    let isFaceKey = e.altKey;
    
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        direction = Direction.Up;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        direction = Direction.Right;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        direction = Direction.Down;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        direction = Direction.Left;
        break;
    }
    
    if (isAttackKey && direction === null) {
      direction = state.playerPosition.direction;
    }
    
    if (direction === null) return;
    
    if (isAttackKey) {
      sendAttack(direction);
      log(`Attack in direction: ${direction}`);
    } else if (isFaceKey) {
      sendFace(direction);
    } else {
      sendWalk(direction);
    }
    
    e.preventDefault();
  });
  
  log("Client ready. Connect to begin.");
});