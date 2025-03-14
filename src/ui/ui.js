// ui.js - UI setup and management
import state, { log } from '../core/state.js';

// DOM elements
export let app;
export let loginContainer;
export let serverUrlInput;
export let usernameInput;
export let passwordInput;
export let connectButton;
export let characterContainer;
export let chatInput;

// Import and function definitions that avoid circular dependencies
let sendWelcomeRequestFn;
export function registerSendWelcomeRequest(fn) {
  sendWelcomeRequestFn = fn;
}

// Setup the UI components
export function setupUI() {
  app = document.getElementById('app');
  loginContainer = document.createElement('div');
  const logContainer = document.createElement('div');

  // Set log container in state
  state.setLogContainer(logContainer);

  loginContainer.style.border = '1px solid #ccc';
  loginContainer.style.padding = '10px';
  loginContainer.style.marginBottom = '10px';

  serverUrlInput = document.createElement('input');
  serverUrlInput.value = 'ws://localhost:9001';
  serverUrlInput.style.width = '200px';
  loginContainer.appendChild(serverUrlInput);

  usernameInput = document.createElement('input');
  usernameInput.placeholder = 'Username';
  usernameInput.value = 'Blue';
  loginContainer.appendChild(usernameInput);

  passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'Password';
  passwordInput.value = 'golden';
  loginContainer.appendChild(passwordInput);

  loginContainer.appendChild(document.createElement('br'));
  connectButton = document.createElement('button');
  connectButton.textContent = 'Connect & Login';
  loginContainer.appendChild(connectButton);

  characterContainer = document.createElement('div');
  characterContainer.style.display = 'none';
  loginContainer.appendChild(characterContainer);

  logContainer.style.height = '250px';
  logContainer.style.overflow = 'auto';
  logContainer.style.border = '1px solid #ccc';
  loginContainer.appendChild(logContainer);

  app.appendChild(loginContainer);

  // Add connection status display
  updateConnectionStatus(false);

  // Add position display
  addPositionDisplay();

  // Add info panel with controls
  addInfoPanel();

  // Add action controls (only chat now)
  const actionControls = createActionControls();
  app.appendChild(actionControls);

  return {
    connectButton,
    actionControls,
    chatInput: document.getElementById('chat-input'),
  };
}

// Create action controls panel
function createActionControls() {
  const actionControls = document.createElement('div');
  actionControls.style.marginTop = '15px';
  actionControls.style.padding = '8px';
  actionControls.style.backgroundColor = '#f0f0f0';
  actionControls.style.border = '1px solid #ccc';
  actionControls.style.borderRadius = '4px';
  actionControls.innerHTML = `
    <strong>Chat:</strong><br>
    <div style="margin-top: 10px;">
      <button id="send-chat">Send Chat</button>
      <input id="chat-input" type="text" placeholder="Chat message" value="Hello world" style="width: 150px">
    </div>
  `;

  chatInput = actionControls.querySelector('#chat-input');
  return actionControls;
}

// Add information panel for controls
function addInfoPanel() {
  const infoPanel = document.createElement('div');
  infoPanel.id = 'info-panel';
  infoPanel.style.padding = '10px';
  infoPanel.style.margin = '10px 0';
  infoPanel.style.backgroundColor = '#e8f4ff';
  infoPanel.style.border = '1px solid #a8d4ff';
  infoPanel.style.borderRadius = '4px';
  infoPanel.innerHTML = `
    <strong>Controls:</strong>
    <ul style="margin: 5px 0; padding-left: 25px;">
      <li>Move: Arrow keys or WASD</li>
      <li>Attack: Ctrl + Arrow keys/WASD</li>
      <li>Face: Alt + Arrow keys/WASD</li>
      <li>Chat: Type message and press Enter</li>
    </ul>
  `;

  app.appendChild(infoPanel);
}

// Update the UI to show connection status
export function updateConnectionStatus(isConnected) {
  const statusDisplay = document.getElementById('connection-status');
  if (!statusDisplay) {
    const statusElem = document.createElement('div');
    statusElem.id = 'connection-status';
    statusElem.style.padding = '5px';
    statusElem.style.marginTop = '10px';
    statusElem.style.marginBottom = '10px';
    statusElem.style.fontWeight = 'bold';
    app.insertBefore(statusElem, app.firstChild);
  }

  const statusDisplay2 = document.getElementById('connection-status');
  if (isConnected) {
    statusDisplay2.textContent = 'Status: Connected';
    statusDisplay2.style.backgroundColor = '#d4f7d4';
    statusDisplay2.style.color = '#007500';
  } else {
    statusDisplay2.textContent = 'Status: Disconnected';
    statusDisplay2.style.backgroundColor = '#f7d4d4';
    statusDisplay2.style.color = '#750000';
  }
}

// Display character selection UI
export function displayCharacterSelection(chars) {
  characterContainer.innerHTML = '';
  characterContainer.style.display = 'block';
  if (!chars.length) {
    characterContainer.innerHTML = '<p>No characters found.</p>';
    return;
  }

  for (const c of chars) {
    const btn = document.createElement('button');
    btn.textContent = `${c.name} (Level ${c.level})`;
    btn.style.margin = '5px';
    btn.addEventListener('click', () => {
      state.selectedCharacterId = c.id;
      log(`Selected character: ${c.name} (#${c.id})`);

      if (sendWelcomeRequestFn) {
        sendWelcomeRequestFn(c.id);
        characterContainer.style.display = 'none';
      } else {
        log('Error: Welcome request function not registered');
      }
    });
    characterContainer.appendChild(btn);
  }
}

// Add position display to UI
function addPositionDisplay() {
  const positionDisplay = document.createElement('div');
  positionDisplay.id = 'position-display';
  positionDisplay.style.marginTop = '10px';
  positionDisplay.style.padding = '5px';
  positionDisplay.style.border = '1px solid #ccc';
  positionDisplay.style.backgroundColor = '#f8f8f8';
  positionDisplay.textContent = 'Not in game';

  app.appendChild(positionDisplay);
}

// Update position display
export function updatePositionDisplay() {
  const positionDisplay = document.getElementById('position-display');
  if (!positionDisplay) return;

  if (state.hasEnteredGame) {
    positionDisplay.textContent = `Position: (${state.playerPosition.x}, ${state.playerPosition.y}) on map ${state.playerPosition.mapId}, facing ${state.playerPosition.direction}`;
  } else {
    positionDisplay.textContent = 'Not in game';
  }
}
