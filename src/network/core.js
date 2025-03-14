// network-core.js - Core network handling functionality
import {
  EoReader,
  EoWriter,
  PacketAction,
  PacketFamily,
  deinterleave,
  encodeNumber,
  flipMsb,
  interleave,
  swapMultiples,
} from 'eolib';

import state, { log } from '../core/state.js';

// Get next sequence using our custom 0-9 cycling counter
export function getNextSequence() {
  if (state.useCustomSequence) {
    // Cycle counter from 0-9
    state.customSequenceCounter = (state.customSequenceCounter + 1) % 10;

    // Calculate actual sequence value
    const sequence =
      (state.customSequenceBase + state.customSequenceCounter) % 256;

    return sequence;
  }
  return state.sequencer.nextSequence();
}

// Send a packet to the server
export function sendPacket(packet) {
  const writer = new EoWriter();
  packet.serialize(writer);
  const buf = writer.toByteArray();
  const data = [...buf];

  // Get next sequence number
  const sequence = getNextSequence();

  // Prepend family, action, sequence
  if (packet.action !== 0xff && packet.family !== 0xff) {
    data.unshift(sequence);
  }
  data.unshift(packet.family);
  data.unshift(packet.action);

  // Encrypt
  const temp = new Uint8Array(data);
  if (temp[0] !== 0xff && temp[1] !== 0xff) {
    swapMultiples(temp, state.clientEncryptionMultiple);
    flipMsb(temp);
    interleave(temp);
  }

  // Add length
  const lengthBytes = encodeNumber(temp.length);
  const payload = new Uint8Array([lengthBytes[0], lengthBytes[1], ...temp]);

  log(`Sending packet - Family=${packet.family}, Action=${packet.action}`);
  state.socket.send(payload);
}

// Main packet handler
export function handlePacket(buf) {
  // Decrypt the packet if needed
  if (buf[0] !== 0xff && buf[1] !== 0xff) {
    deinterleave(buf);
    flipMsb(buf);
    swapMultiples(buf, state.serverEncryptionMultiple);
  }
  const action = buf[0];
  const family = buf[1];
  const reader = new EoReader(buf.slice(2));

  // Log received packet unless it's a ping
  if (!(family === PacketFamily.Connection && action === PacketAction.Player)) {
    log(`Received packet - Family=${family}, Action=${action}`);
  }

  return { action, family, reader };
}
