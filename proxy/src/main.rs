use eolib::data::decode_number;
use futures_util::{SinkExt, StreamExt};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::{TcpListener, TcpStream},
    sync::mpsc::{self, UnboundedReceiver},
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
    let mut eosocket = TcpStream::connect("localhost:8078")
        .await
        .expect("Error during eo server connection");

    let websocket = accept_async(stream)
        .await
        .expect("Error during the websocket handshake occurred");

    let (tx, rx) = mpsc::unbounded_channel::<Vec<u8>>();

    let mut ws = WS::new(websocket, rx);

    loop {
        tokio::select! {
                    Some(message) = ws.socket.next() => match message {
                        Ok(Message::Binary(buf)) => {
                            let _ = eosocket.write(&buf).await;
                        }
                        _ => {}
                    },
                    _ = async {
        let mut length_buf = vec![0; 2];
                    match eosocket.read(&mut length_buf).await {
                        Ok(bytes_read) => {
                            if bytes_read == 0 {
                            return;
                            }
                        }
                        Err(_) => {}
                    }

                    let length = decode_number(&length_buf);
                    if length != 0 {
                        let mut buf = vec![0; length as usize];
                        match eosocket.read(&mut buf).await {
                            Ok(bytes_read) => {
                                if bytes_read == 0 {
                            return;
                                }
                            }
                            Err(_) => {}
                        }

                        println!("Recv: {:?}", buf);

                        let _ = tx.send(buf);
                    }
                        } => {}
            Some(buf) = ws.rx.recv() => {
                println!("Sending: {:?}", buf);
                let _ = ws.socket.send(Message::Binary(buf)).await;
            }
                }
    }
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
