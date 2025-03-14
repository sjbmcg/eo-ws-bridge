// network-actions.js - User-initiated network actions
import {
  AttackUseClientPacket,
  Coords,
  Direction,
  FacePlayerClientPacket,
  RefreshRequestClientPacket,
  TalkReportClientPacket,
  WalkAction,
  WalkPlayerClientPacket,
  WelcomeRequestClientPacket,
} from 'eolib';

import state, { log } from '../core/state.js';
import * as ui from '../ui/ui.js';
import { sendPacket } from './core.js';

// Send attack command with proper sequence handling
export function sendAttack(direction) {
  if (!state.hasEnteredGame) {
    log('Cannot attack: not in game yet');
    return false;
  }

  // Throttle attack commands
  const now = Date.now();
  if (now - state.lastAttackTime < 10) {
    // 10ms cooldown
    log(
      `Attack command throttled (${
        now - state.lastAttackTime
      }ms since last attack)`,
    );
    return false;
  }
  state.lastAttackTime = now;

  // Create attack packet with current timestamp
  const timestamp = Math.floor(now / 10) % 16194276;

  const packet = new AttackUseClientPacket();
  packet.timestamp = timestamp;
  packet.direction = direction;

  sendPacket(packet);

  // Track attack count
  state.attackCount++;
  log(
    `Attacking in direction: ${direction} (attack count: ${state.attackCount})`,
  );

  return true;
}

// Send walk command with proper sequence handling
export function sendWalk(direction) {
  if (!state.hasEnteredGame) {
    log('Cannot walk: not in game yet');
    return false;
  }

  // Throttle walk commands to prevent spam
  const now = Date.now();
  if (now - state.lastWalkTime < 150) {
    // 150ms minimum between walks
    return false;
  }
  state.lastWalkTime = now;

  // MODIFIED: Create timestamp for walk packet with proper bounds checking
  // Using 24-bit max value (0xFFFFFF or 16777215) and ensuring it's within bounds
  const timestamp = Math.floor(now / 10) % 16194276; // Use the max value from error message

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

  const packet = new WalkPlayerClientPacket();
  packet.walkAction = walkAction;

  // Send walk packet
  sendPacket(packet);

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
    log('Cannot chat: not in game yet');
    return false;
  }

  const packet = new TalkReportClientPacket();
  packet.message = message;

  sendPacket(packet);

  log(`Sent chat message: ${message}`);
  return true;
}

// Send welcome request (character selection)
export function sendWelcomeRequest(characterId) {
  const packet = new WelcomeRequestClientPacket();
  packet.characterId = characterId;

  sendPacket(packet);
}

// Request a refresh of nearby entities
export function sendRefreshRequest() {
  sendPacket(new RefreshRequestClientPacket());
  log('Requested refresh of nearby entities');
}

// Send player facing direction change
export function sendFace(direction) {
  if (!state.hasEnteredGame) {
    log('Cannot face: not in game yet');
    return false;
  }

  // Create the face packet
  const packet = new FacePlayerClientPacket();
  packet.direction = direction;
  sendPacket(packet);

  // Update local direction immediately for better responsiveness
  state.playerPosition.direction = direction;
  ui.updatePositionDisplay();

  log(`Faced direction: ${direction}`);
  return true;
}
