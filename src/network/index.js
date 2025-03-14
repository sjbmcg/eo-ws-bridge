// network.js - Main network module that ties everything together
import {
  Version,
  InitInitClientPacket,
  PacketFamily,
  PacketAction
} from "eolib";

import state, { log } from '../core/state.js';
import * as ui from '../ui/ui.js';
import { 
  handleInitPacket, 
  handleConnectionPlayer, 
  handleLoginReply, 
  handleWelcomeReply,
  handlePlayersAgree,
  handlePlayerRemove,
  handleNearbyInfo,
  handleNpcPlayer
} from './handlers.js';
import { sendPacket, handlePacket } from './core.js';  // Import handlePacket too

// Re-export all action functions for ease of use
export { 
  sendAttack, 
  sendWalk, 
  sendChat, 
  sendWelcomeRequest,
  sendRefreshRequest,
  sendFace
} from './actions.js';

// Also re-export core functions
export { sendPacket, handlePacket } from './core.js';

// Update socket event handling to show connection status
export function connectAndLogin() {
  ui.connectButton.disabled = true;
  log("Connecting...");

  // Reset states
  state.reset();

  if (state.socket && state.socket.readyState !== WebSocket.CLOSED) {
    state.socket.onclose = null;
    state.socket.close();
  }
  state.socket = new WebSocket(ui.serverUrlInput.value);

  state.socket.addEventListener("open", () => {
    log("Connected");
    ui.updateConnectionStatus(true);
    let init = new InitInitClientPacket();
    init.version = new Version();
    init.version.major = 0;
    init.version.minor = 0;
    init.version.patch = 28;
    init.challenge = 12345;
    init.hdid = "161726351";
    sendPacket(init);
  });

  state.socket.addEventListener("message", e => {
    e.data
      .arrayBuffer()
      .then(buf => {
        const rawBytes = new Uint8Array(buf);
        const { action, family, reader } = handlePacket(rawBytes);
        
        // Route packet to appropriate handler
        if (family === 0xff && action === 0xff) {
          handleInitPacket(reader);
        } else if (family === PacketFamily.Connection && action === PacketAction.Player) {
          handleConnectionPlayer(reader);
        } else if (family === PacketFamily.Login && action === PacketAction.Reply) {
          handleLoginReply(reader);
        } else if (family === PacketFamily.Welcome && action === PacketAction.Reply) {
          handleWelcomeReply(reader);
        } else if (family === PacketFamily.Players && action === PacketAction.Agree) {
          handlePlayersAgree(reader);
        } else if (family === PacketFamily.Avatar && action === PacketAction.Remove) {
          handlePlayerRemove(reader);
        } else if ((family === PacketFamily.Refresh && action === PacketAction.Reply) ||
                 (family === PacketFamily.Range && action === PacketAction.Reply)) {
          handleNearbyInfo(reader);
        } else if (family === PacketFamily.Npc && action === PacketAction.Player) {
          let oldPosition = reader.position;
          try {
            let pid = reader.getShort();
            let direction = reader.getChar();
            // Use seek() method instead of directly assigning to position
            reader.seek(oldPosition); // Reset for full parsing
          } catch (e) {
            // Use seek() method instead of directly assigning to position
            reader.seek(oldPosition);
            handleNpcPlayer(reader);
          }
        } else if ((family === PacketFamily.Init && action === PacketAction.Init) ||
                 (family === PacketFamily.Warp && action === PacketAction.Create)) {
          state.mapLoaded = true;
          log("Map data received");
        }
      });
  });

  state.socket.addEventListener("close", (e) => {
    log(`Connection closed (code: ${e.code}, reason: ${e.reason || "none"})`);
    ui.updateConnectionStatus(false);
    ui.connectButton.disabled = false;
  });

  state.socket.addEventListener("error", () => {
    log("Connection error");
    ui.updateConnectionStatus(false);
    ui.connectButton.disabled = false;
  });
}