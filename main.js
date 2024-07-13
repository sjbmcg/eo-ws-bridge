import {
  EoReader,
  EoWriter,
  InitInitClientPacket,
  InitInitServerPacket,
  Version,
  encodeNumber,
} from "eolib";

const app = document.getElementById("app");

const log = (message) => {
  const item = document.createElement("div");
  item.innerText = message;
  app.appendChild(item);
};

const socket = new WebSocket("ws://localhost:9001");

const send = (packet) => {
  const writer = new EoWriter();
  packet.serialize(writer);

  const buf = writer.toByteArray();

  if (buf[0] === 0xff && buf[1] === 0xff) {
    // todo: encode
  }

  const lengthBytes = encodeNumber(buf.length + 2);

  const payload = new Uint8Array([
    lengthBytes[0],
    lengthBytes[1],
    packet.action,
    packet.family,
    ...buf,
  ]);
  socket.send(payload);
};

const handle_packet = (buf) => {
  const action = buf[0];
  const family = buf[1];

  const packetBuf = buf.slice(2);
  const reader = new EoReader(packetBuf);

  if (action === 0xff && family === 0xff) {
    const serverInit = InitInitServerPacket.deserialize(reader);
    log(`Received init packet: ${JSON.stringify(serverInit)}`);
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
