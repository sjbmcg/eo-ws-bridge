// packet-handlers.js - Handlers for different packet types
import {
  AvatarRemoveServerPacket,
  ConnectionAcceptClientPacket,
  ConnectionPingClientPacket,
  ConnectionPlayerServerPacket,
  InitInitServerPacket,
  InitReply,
  InitSequenceStart,
  LoginReply,
  LoginReplyServerPacket,
  LoginRequestClientPacket,
  NpcPlayerServerPacket,
  PingSequenceStart,
  PlayersAgreeServerPacket,
  PlayersRemoveServerPacket,
  RangeReplyServerPacket,
  RefreshReplyServerPacket,
  WarpAcceptClientPacket,
  WarpRequestServerPacket,
  WelcomeCode,
  WelcomeMsgClientPacket,
  WelcomeReplyServerPacket,
} from 'eolib';

import state, { log } from '../core/state.js';
import * as ui from '../ui/ui.js';
import { sendRefreshRequest } from './actions.js';
import { sendPacket } from './core.js';

// Handle the init handshake
export function handleInitPacket(reader) {
  const init = InitInitServerPacket.deserialize(reader);
  if (init.replyCode === InitReply.Ok) {
    state.sequencer.sequenceStart = InitSequenceStart.fromInitValues(
      init.replyCodeData.seq1,
      init.replyCodeData.seq2,
    );
    state.clientEncryptionMultiple =
      init.replyCodeData.clientEncryptionMultiple;
    state.serverEncryptionMultiple =
      init.replyCodeData.serverEncryptionMultiple;
    state.playerId = init.replyCodeData.playerId;

    log(`Init OK: playerId=${state.playerId}`);

    const accept = new ConnectionAcceptClientPacket();
    accept.serverEncryptionMultiple = state.serverEncryptionMultiple;
    accept.clientEncryptionMultiple = state.clientEncryptionMultiple;
    accept.playerId = state.playerId;
    sendPacket(accept);

    setTimeout(() => {
      const login = new LoginRequestClientPacket();
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
    ping.seq2,
  );

  // Send ping response immediately
  sendPacket(new ConnectionPingClientPacket());
}

// Handle login reply with character list
export function handleLoginReply(reader) {
  const packet = LoginReplyServerPacket.deserialize(reader);
  if (packet.replyCode === LoginReply.Ok) {
    log('Login successful');

    ui.displayCharacterSelection(
      packet.replyCodeData.characters.map((c) => ({
        id: c.id,
        name: c.name,
        level: c.level,
      })),
    );
  } else {
    log(`Login failed: code=${packet.replyCode}`);
    ui.connectButton.disabled = false;
  }
}

// Handle welcome reply with character details and game entry
export function handleWelcomeReply(reader) {
  const packet = WelcomeReplyServerPacket.deserialize(reader);
  if (packet.welcomeCode === WelcomeCode.SelectCharacter) {
    const data = packet.welcomeCodeData;
    state.sessionId = data.sessionId;
    log(
      `Character select: sess=${state.sessionId}, charId=${data.characterId}, map=${data.mapId}, mapSize=${data.mapFileSize}`,
    );

    state.playerPosition.mapId = data.mapId;

    log(`Loaded character: ${data.name}`);

    // Request game entry
    const welcomeMsg = new WelcomeMsgClientPacket();
    welcomeMsg.sessionId = state.sessionId;
    welcomeMsg.characterId = data.characterId;
    sendPacket(welcomeMsg);
    log('Requested EnterGame');
  } else if (packet.welcomeCode === WelcomeCode.EnterGame) {
    // EnterGame
    log('Entering game world');

    for (const news of packet.welcomeCodeData.news) {
      log(news);
    }

    processNearbyInfo(packet.welcomeCodeData.nearby);

    // Complete game entry
    completeGameEntry();
  }
}

// Handle NPC player updates (merged/duplicated packet handling)
export function handleNpcPlayer(reader) {
  const _packet = NpcPlayerServerPacket.deserialize(reader);
}

export function handlePlayersAgree(reader) {
  log('Received player appearance update');
  const packet = PlayersAgreeServerPacket.deserialize(reader);
  processNearbyInfo(packet.nearby);
}

// Process the deserialized NearbyInfo
export function processNearbyInfo(nearbyData) {
  if (!nearbyData) {
    log('No nearby data received');
    return;
  }

  // Process characters
  if (nearbyData.characters?.length) {
    log(`Found ${nearbyData.characters.length} nearby characters`);

    for (const character of nearbyData.characters) {
      if (character.playerId === state.playerId) {
        // Update our own position
        state.playerPosition.x = character.coords.x;
        state.playerPosition.y = character.coords.y;
        state.playerPosition.mapId = character.mapId;
        state.playerPosition.direction = character.direction;
        log(
          `My position: (${character.coords.x},${character.coords.y}) on map ${character.mapId}, facing ${character.direction}`,
        );
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
          maxHp: character.maxHp,
        };
        log(
          `Nearby player: ${character.name} (#${character.playerId}) at (${character.coords.x},${character.coords.y})`,
        );
      }
    }
  } else {
    log('No nearby characters found');
  }

  // Log NPCs and items count
  if (nearbyData.npcs?.length) {
    log(`Found ${nearbyData.npcs.length} NPCs nearby`);
  }

  if (nearbyData.items?.length) {
    log(`Found ${nearbyData.items.length} items on the ground`);
  }
}

// Handle Avatar_Remove packet to remove players
export function handlePlayersRemove(reader) {
  const packet = PlayersRemoveServerPacket.deserialize(reader);
  const pid = packet.playerId;
  if (state.nearbyPlayers[pid]) {
    log(`Player #${pid} (${state.nearbyPlayers[pid].name}) left view`);
    delete state.nearbyPlayers[pid];
  } else {
    log(`Unknown player #${pid} left view`);
  }
}

export function handleAvatarRemove(reader) {
  const packet = AvatarRemoveServerPacket.deserialize(reader);
  const pid = packet.playerId;
  if (state.nearbyPlayers[pid]) {
    log(`Player #${pid} (${state.nearbyPlayers[pid].name}) left view`);
    delete state.nearbyPlayers[pid];
  } else {
    log(`Unknown player #${pid} left view`);
  }
}

export function handleRefreshReply(reader) {
  const packet = RefreshReplyServerPacket.deserialize(reader);
  processNearbyInfo(packet.nearby);
}

export function handleRangeReply(reader) {
  const packet = RangeReplyServerPacket.deserialize(reader);
  processNearbyInfo(packet.nearby);
}

export function handleWarpRequest(reader) {
  const packet = WarpRequestServerPacket.deserialize(reader);
  const reply = new WarpAcceptClientPacket();
  reply.mapId = packet.mapId;
  reply.sessionId = packet.sessionId;
  sendPacket(reply);
}

// Complete game entry
export function completeGameEntry() {
  state.hasEnteredGame = true;
  log('Fully entered game world');

  // Request refresh to get initial state
  sendRefreshRequest();

  // Update position display
  ui.updatePositionDisplay();
}
