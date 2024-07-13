import {
  ConnectionAcceptClientPacket,
  ConnectionPingClientPacket,
  ConnectionPlayerServerPacket,
  EoReader,
  EoWriter,
  InitInitClientPacket,
  InitInitServerPacket,
  InitReply,
  InitSequenceStart,
  PacketAction,
  PacketFamily,
  PacketSequencer,
  PingSequenceStart,
  SequenceStart,
  Version,
  deinterleave,
  encodeNumber,
  flipMsb,
  interleave,
  swapMultiples,
} from "eolib";

const app = document.getElementById("app");

const log = (message) => {
  const item = document.createElement("div");
  item.innerText = message;
  app.appendChild(item);
};

const socket = new WebSocket("ws://localhost:9001");

const sequencer = new PacketSequencer();
sequencer.sequenceStart = SequenceStart.zero();
sequencer.nextSequence();

let clientEncryptionMultiple = 0;
let serverEncryptionMultiple = 0;
let playerId = 0;

const send = (packet) => {
  const writer = new EoWriter();
  packet.serialize(writer);

  const buf = writer.toByteArray();

  const data = [...buf];
  const sequence = sequencer.nextSequence();

  if (packet.action !== 0xff && packet.family !== 0xff) {
    data.unshift(sequence);
  }

  data.unshift(packet.family);
  data.unshift(packet.action);

  const temp = new Uint8Array(data);

  if (data[0] !== 0xff && data[1] !== 0xff) {
    swapMultiples(temp, clientEncryptionMultiple);
    flipMsb(temp);
    interleave(temp);
  }

  const lengthBytes = encodeNumber(temp.length);

  const payload = new Uint8Array([lengthBytes[0], lengthBytes[1], ...temp]);
  socket.send(payload);
};

const handle_packet = (buf) => {
  if (buf[0] !== 0xff && buf[1] !== 0xff) {
    deinterleave(buf);
    flipMsb(buf);
    swapMultiples(buf, serverEncryptionMultiple);
  }

  const action = buf[0];
  const family = buf[1];

  const packetBuf = buf.slice(2);
  const reader = new EoReader(packetBuf);

  if (action === 0xff && family === 0xff) {
    const init = InitInitServerPacket.deserialize(reader);
    log(`Received init packet: ${JSON.stringify(init)}`);

    if (init.replyCode === InitReply.Ok) {
      sequencer.sequenceStart = InitSequenceStart.fromInitValues(
        init.replyCodeData.seq1,
        init.replyCodeData.seq2,
      );

      clientEncryptionMultiple = init.replyCodeData.clientEncryptionMultiple;
      serverEncryptionMultiple = init.replyCodeData.serverEncryptionMultiple;
      playerId = init.replyCodeData.playerId;

      const accept = new ConnectionAcceptClientPacket();
      accept.serverEncryptionMultiple = serverEncryptionMultiple;
      accept.clientEncryptionMultiple = clientEncryptionMultiple;
      accept.playerId = playerId;

      log(`Sending Connection_Accept: ${JSON.stringify(accept)}`);

      send(accept);
    }
  }

  if (action === PacketAction.Player && family === PacketFamily.Connection) {
    const ping = ConnectionPlayerServerPacket.deserialize(reader);
    sequencer.sequenceStart = PingSequenceStart.fromPingValues(
      ping.seq1,
      ping.seq2,
    );

    log("Server ping");

    send(new ConnectionPingClientPacket());
  }
};

socket.addEventListener("open", () => {
  const init = new InitInitClientPacket();
  init.version = new Version();
  init.version.major = 0;
  init.version.minor = 0;
  init.version.patch = 28;
  init.challenge = 12345;
  init.hdid = "161726351";

  log(`Sending init packet: ${JSON.stringify(init)}`);
  send(init);
});

socket.addEventListener("message", (e) => {
  const promise = e.data.arrayBuffer();
  promise
    .then((buf) => {
      handle_packet(new Uint8Array(buf));
    })
    .catch((err) => {
      console.error("Failed to get array buffer", err);
    });
});
