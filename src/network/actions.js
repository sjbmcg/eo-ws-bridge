// network-actions.js - User-initiated network actions
import {
  PacketAction,
  PacketFamily,
  Direction,
  Coords,
  WalkAction
} from "eolib";

import state, { log } from '../core/state.js';
import * as ui from '../ui/ui.js';
import { sendPacket } from './core.js';

// Send attack command with proper sequence handling
export function sendAttack(direction) {
  if (!state.hasEnteredGame) {
    log("Cannot attack: not in game yet");
    return false;
  }
  
  // Throttle attack commands
  const now = Date.now();
  if (now - state.lastAttackTime < 10) { // 10ms cooldown
    log(`Attack command throttled (${now - state.lastAttackTime}ms since last attack)`);
    return false;
  }
  state.lastAttackTime = now;

  // Create attack packet with current timestamp
  const timestamp = Math.floor(now / 10) % 16777216; // 3-byte timestamp (0-16777215)
  
  sendPacket({
    family: PacketFamily.Attack,
    action: PacketAction.Use,
    serialize: (writer) => {
      writer.addChar(direction);
      writer.addThree(timestamp);
    }
  });
  
  // Track attack count
  state.attackCount++;
  log(`Attacking in direction: ${direction} (attack count: ${state.attackCount})`);
  
  return true;
}

// Send walk command with proper sequence handling
export function sendWalk(direction) {
  if (!state.hasEnteredGame) {
    log("Cannot walk: not in game yet");
    return false;
  }
  
  // Throttle walk commands to prevent spam
  const now = Date.now();
  if (now - state.lastWalkTime < 150) { // 150ms minimum between walks
    return false;
  }
  state.lastWalkTime = now;

  // Create timestamp for walk packet (3-byte timestamp)
  const timestamp = Math.floor(now / 10) % 16777216;
  
  // Create coords object with current position
  const coords = new Coords();
  coords.x = state.playerPosition.x;
  coords.y = state.playerPosition.y;
  
  // Predict new position based on direction
  switch (direction) {
    case Direction.Up:
      coords.y--;
      break;
    case Direction.Right:
      coords.x++;
      break;
    case Direction.Down:
      coords.y++;
      break;
    case Direction.Left:
      coords.x--;
      break;
  }
  
  // Create walk action
  const walkAction = new WalkAction();
  walkAction.direction = direction;
  walkAction.timestamp = timestamp;
  walkAction.coords = coords;
  
  // Send walk packet
  sendPacket({
    family: PacketFamily.Walk,
    action: PacketAction.Use,
    serialize: (writer) => {
      WalkAction.serialize(writer, walkAction);
    }
  });
  
  // Update local position immediately for better responsiveness
  state.playerPosition.x = coords.x;
  state.playerPosition.y = coords.y;
  state.playerPosition.direction = direction;
  ui.updatePositionDisplay();
  
  return true;
}

// Send simple chat message
export function sendChat(message) {
  if (!state.hasEnteredGame) {
    log("Cannot chat: not in game yet");
    return false;
  }
  
  sendPacket({
    family: PacketFamily.Talk,
    action: PacketAction.Report, // Public chat
    serialize: (writer) => {
      writer.addString(message);
    }
  });
  
  log(`Sent chat message: ${message}`);
  return true;
}

// Send welcome request (character selection)
export function sendWelcomeRequest(characterId) {
  sendPacket({
    family: PacketFamily.Welcome,
    action: PacketAction.Request,
    serialize: w => w.addInt(characterId),
  });
}

// Request a refresh of nearby entities
export function sendRefreshRequest() {
  sendPacket({
    family: PacketFamily.Refresh,
    action: PacketAction.Request,
    serialize: w => w.addByte(255),
  });
  log("Requested refresh of nearby entities");
}

// Send player facing direction change
export function sendFace(direction) {
  if (!state.hasEnteredGame) {
    log("Cannot face: not in game yet");
    return false;
  }
  
  // Create the face packet
  sendPacket({
    family: PacketFamily.Face,
    action: PacketAction.Player,
    serialize: (writer) => {
      writer.addChar(direction);
    }
  });
  
  // Update local direction immediately for better responsiveness
  state.playerPosition.direction = direction;
  ui.updatePositionDisplay();
  
  log(`Faced direction: ${direction}`);
  return true;
}