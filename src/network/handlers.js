// packet-handlers.js - Handlers for different packet types
import {
  ConnectionPingClientPacket,
  ConnectionPlayerServerPacket,
  InitInitServerPacket,
  InitReply,
  InitSequenceStart,
  ConnectionAcceptClientPacket,
  LoginRequestClientPacket,
  WarpTakeClientPacket,
  WelcomeMsgClientPacket,
  PacketAction,
  PacketFamily,
  PingSequenceStart,
  NearbyInfo
} from "eolib";

import state, { log } from '../core/state.js';
import * as ui from '../ui/ui.js';
import { sendPacket } from './core.js';
import { sendRefreshRequest } from './actions.js';

// Handle the init handshake
export function handleInitPacket(reader) {
  let init = InitInitServerPacket.deserialize(reader);
  if (init.replyCode === InitReply.Ok) {
    state.sequencer.sequenceStart = InitSequenceStart.fromInitValues(
      init.replyCodeData.seq1,
      init.replyCodeData.seq2
    );
    state.clientEncryptionMultiple = init.replyCodeData.clientEncryptionMultiple;
    state.serverEncryptionMultiple = init.replyCodeData.serverEncryptionMultiple;
    state.playerId = init.replyCodeData.playerId;
    
    // Set custom sequence base to match initial sequence (assuming first is position 0)
    if (state.useCustomSequence) {
      // Extract first sequence number the library would generate (will be position 0)
      const firstSeq = state.sequencer.nextSequence();
      state.customSequenceBase = firstSeq;
      state.customSequenceCounter = 0; // Reset to 0
    }
    
    log(`Init OK: playerId=${state.playerId}`);

    let accept = new ConnectionAcceptClientPacket();
    accept.serverEncryptionMultiple = state.serverEncryptionMultiple;
    accept.clientEncryptionMultiple = state.clientEncryptionMultiple;
    accept.playerId = state.playerId;
    sendPacket(accept);

    setTimeout(() => {
      let login = new LoginRequestClientPacket();
      login.username = ui.usernameInput.value;
      login.password = ui.passwordInput.value;
      log(`Logging in as: ${ui.usernameInput.value}`);
      sendPacket(login);
    }, 300);
  } else {
    log(`Init failed, code=${init.replyCode}`);
  }
}

// Handle Connection_Player packet (server ping)
export function handleConnectionPlayer(reader) {
  const ping = ConnectionPlayerServerPacket.deserialize(reader);
  
  // Update the sequence start using the ping values
  state.sequencer.sequenceStart = PingSequenceStart.fromPingValues(
    ping.seq1,
    ping.seq2
  );
  
  // Send ping response immediately
  sendPacket(new ConnectionPingClientPacket());
}

// Handle login reply with character list
export function handleLoginReply(reader) {
  let replyCode = reader.getShort();
  if (replyCode === 3 || replyCode === 5) {
    log("Login successful");
    reader.getChar(); 
    reader.getChar();
    reader.chunkedReadingMode = true;
    reader.nextChunk();

    let characters = [];
    while (reader.remaining > 0) {
      let name = reader.getString();
      if (!name) break;
      reader.nextChunk();
      if (reader.remaining < 7) break;
      let id = reader.getInt();
      let level = reader.getChar();
      characters.push({ name, id, level });
      if (reader.remaining > 0) {
        reader.nextChunk();
      }
    }
    ui.displayCharacterSelection(characters);
  } else {
    log(`Login failed: code=${replyCode}`);
    ui.connectButton.disabled = false;
  }
}

// Handle welcome reply with character details and game entry
export function handleWelcomeReply(reader) {
  let welcomeCode = reader.getShort(); 
  
  if (welcomeCode === 1) {  // SelectCharacter
    state.sessionId = reader.getShort();
    let charId = reader.getInt();
    let mapId = reader.getShort();
    
    // Skip map RID and file size
    reader.getShort(); // mapRid1
    reader.getShort(); // mapRid2
    let mapFileSize = reader.getThree();
    
    log(`Character select: sess=${state.sessionId}, charId=${charId}, map=${mapId}, mapSize=${mapFileSize}`);
    
    state.playerPosition.mapId = mapId;
    
    // Skip file RIDs and lengths
    for (let i = 0; i < 12; i++) {
      reader.getShort();
    }
    
    // Switch to chunked reading for string data
    reader.chunkedReadingMode = true;
    
    // Read character info
    let name = reader.getString();
    reader.nextChunk();
    
    log(`Loaded character: ${name}`);

    // Send warp handshake
    const warpTake = new WarpTakeClientPacket();
    warpTake.mapId = mapId;
    warpTake.sessionId = state.sessionId;
    sendPacket(warpTake);
    log(`Sent warp handshake for map=${mapId}`);

    // Request game entry
    setTimeout(() => {
      let welcomeMsg = new WelcomeMsgClientPacket();
      welcomeMsg.sessionId = state.sessionId;
      welcomeMsg.characterId = charId;
      sendPacket(welcomeMsg);
      log("Requested EnterGame");
    }, 500);

  } else if (welcomeCode === 2) {  // EnterGame
    log("Entering game world");
    
    // Parse news and other data quickly
    reader.chunkedReadingMode = true;
    reader.nextChunk();
    
    // Skip news items
    for (let i = 0; i < 9; i++) {
      reader.getString();
    }
    
    // Skip inventory and spells data
    reader.nextChunk();
    while (reader.remaining > 0) {
      reader.getShort(); // itemId
      reader.getInt();   // itemAmount
    }
    
    reader.nextChunk();
    while (reader.remaining > 0) {
      reader.getShort(); // spellId
      reader.getShort(); // spellLevel
    }
    
    // Now try to parse nearby info which has our position
    reader.nextChunk();
    parseNearbyInfo(reader);
    
    // Complete game entry
    completeGameEntry();
  }
}

// Handle NPC player updates (merged/duplicated packet handling)
export function handleNpcPlayer(reader) {
  try {
    reader.chunkedReadingMode = true;
    // read or skip the entire chunk for positions
    while (!reader.chunkBoundaryReached) {
      // skip 1 + 1 + 1 + 1 = 4 bytes
      reader.skip(4);
    }
    reader.nextChunk();

    // skip the entire chunk for attacks
    while (!reader.chunkBoundaryReached) {
      // skip 1 + 1 + 1 + 2 + 3 + 1 = 9 bytes
      reader.skip(9);
    }
    reader.nextChunk();

    // skip the entire chunk for chats
    while (!reader.chunkBoundaryReached) {
      // skip 1 (npcIndex) + 1 (length) + the string bytes
      let npcIndex = reader.getChar();
      let length = reader.getChar();
      reader.skip(length);
    }
    reader.nextChunk();

    // skip optional hp/tp
    if (reader.remaining >= 2) reader.skip(2);
    if (reader.remaining >= 2) reader.skip(2);
  }
  catch (e) {
    log(`Error parsing NPC update packet: ${e.message}`);
  }
}

// Standard function for reading nearby info with proper chunked handling
export function parseNearbyInfo(reader) {
  // Ensure we're in chunked mode
  reader.chunkedReadingMode = true;
  
  try {
    const nearbyData = NearbyInfo.deserialize(reader);
    processNearbyInfo(nearbyData);
  } catch (e) {
    log(`Error parsing nearby info: ${e.message}`);
  }
}

export function handlePlayersAgree(reader) {
  log("Received player appearance update");
  parseNearbyInfo(reader);
}

// Handle nearby info from Refresh_Reply or Range_Reply
export function handleNearbyInfo(reader) {
  log("Received nearby entity update");
  
  // Reset the reader to chunked mode
  reader.chunkedReadingMode = true;
  
  // Skip any prefix byte (255) that might exist in certain packets
  if (reader.remaining > 0 && reader.getChar() !== 255) {
    // If it wasn't 255, we need to reposition
    log("Warning: No prefix byte found, data might be malformed");
  }
  
  // Now parse the NearbyInfo structure
  parseNearbyInfo(reader);
}

// Process the deserialized NearbyInfo
export function processNearbyInfo(nearbyData) {
  if (!nearbyData) {
    log("No nearby data received");
    return;
  }
  
  // Process characters
  if (nearbyData.characters && nearbyData.characters.length) {
    log(`Found ${nearbyData.characters.length} nearby characters`);
    
    nearbyData.characters.forEach(character => {
      if (character.playerId === state.playerId) {
        // Update our own position
        state.playerPosition.x = character.coords.x;
        state.playerPosition.y = character.coords.y;
        state.playerPosition.mapId = character.mapId;
        state.playerPosition.direction = character.direction;
        log(`My position: (${character.coords.x},${character.coords.y}) on map ${character.mapId}, facing ${character.direction}`);
        ui.updatePositionDisplay();
      } else if (character.playerId > 0) {
        // Track other players
        state.nearbyPlayers[character.playerId] = {
          id: character.playerId,
          name: character.name,
          x: character.coords.x,
          y: character.coords.y,
          direction: character.direction,
          mapId: character.mapId,
          classId: character.classId,
          level: character.level,
          hp: character.hp,
          maxHp: character.maxHp
        };
        log(`Nearby player: ${character.name} (#${character.playerId}) at (${character.coords.x},${character.coords.y})`);
      }
    });
  } else {
    log("No nearby characters found");
  }
  
  // Log NPCs and items count
  if (nearbyData.npcs && nearbyData.npcs.length) {
    log(`Found ${nearbyData.npcs.length} NPCs nearby`);
  }
  
  if (nearbyData.items && nearbyData.items.length) {
    log(`Found ${nearbyData.items.length} items on the ground`);
  }
}

// Handle Avatar_Remove packet to remove players
export function handlePlayerRemove(reader) {
  let pid = reader.getShort();
  if (state.nearbyPlayers[pid]) {
    log(`Player #${pid} (${state.nearbyPlayers[pid].name}) left view`);
    delete state.nearbyPlayers[pid];
  } else {
    log(`Unknown player #${pid} left view`);
  }
}

// Complete game entry
export function completeGameEntry() {
  state.hasEnteredGame = true;
  log("Fully entered game world");
  
  // Request refresh to get initial state
  sendRefreshRequest();
  
  // Update position display
  ui.updatePositionDisplay();
}