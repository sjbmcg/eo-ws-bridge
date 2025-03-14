use eolib::data::decode_number;
use futures_util::{SinkExt, StreamExt};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::mpsc::{self, UnboundedReceiver, UnboundedSender},
};
use tokio_tungstenite::{accept_async, tungstenite::Message, WebSocketStream};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let server = TcpListener::bind("127.0.0.1:9001").await?;
    println!("WebSocket listening at wss://127.0.0.1:9001");

    while let Ok((stream, _)) = server.accept().await {
        tokio::spawn(accept_connection(stream));
    }

    Ok(())
}

async fn accept_connection(stream: TcpStream) {
    let mut eosocket = TcpStream::connect("reoserv.net:8078")
        .await
        .expect("Error during eo server connection");

    let websocket = accept_async(stream)
        .await
        .expect("Error during the websocket handshake occurred");

    println!("Websocket connection accepted");

    let (tx, rx) = mpsc::unbounded_channel::<Vec<u8>>();

    let mut ws = WS::new(websocket, rx);

    loop {
        tokio::select! {
            Some(message) = ws.socket.next() => match message {
                Ok(Message::Binary(buf)) => {
                    if let Err(_) = eosocket.write(&buf).await {
                        // Client disconnected
                        break;
                    }
                }
                _ => {}
            },
            result = read_eo_packet(&mut eosocket, &tx) => match result {
                    Ok(Some(bytes_read)) => {
                        if bytes_read == 0 {
                            // Server disconnected
                            break;
                        }
                    }
                    _ => {}
                },
            Some(buf) = ws.rx.recv() => {
                if let Err(_) = ws.socket.send(Message::Binary(buf)).await {
                    // Client disconnected
                    break;
                }
            }
        }
    }

    println!("Websocket connection dropped");
}

async fn read_eo_packet(
    eosocket: &mut TcpStream,
    tx: &UnboundedSender<Vec<u8>>,
) -> Result<Option<usize>, Box<dyn std::error::Error + Send + Sync>> {
    let mut length_buf = vec![0; 2];
    eosocket.read(&mut length_buf).await?;

    let length = decode_number(&length_buf);
    let mut buf = vec![0; length as usize];
    let bytes_read = eosocket.read(&mut buf).await?;

    let _ = tx.send(buf);
    Ok(Some(bytes_read))
}

struct WS {
    pub socket: WebSocketStream<TcpStream>,
    pub rx: UnboundedReceiver<Vec<u8>>,
}

impl WS {
    pub fn new(socket: WebSocketStream<TcpStream>, rx: UnboundedReceiver<Vec<u8>>) -> Self {
        Self { socket, rx }
    }
}
