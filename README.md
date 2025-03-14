# EO WebSocket Bridge

An endless web client for connecting to game servers via the WebSocket protocol.

## Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (latest stable version)
- [Node.js](https://nodejs.org/) (v14 or later)
- npm (included with Node.js)

## Setup Instructions

### 1. Start the Proxy Server

First, start the Rust-based proxy server by running:

```bash
npm run proxy
```

### 2. Start the Client Application

Next, open a new terminal window, navigate to the src directory, and install dependencies (if not done already):

```bash
npm install  # Only needed the first time
npm run dev  # Starts the development server
```

Then open your browser and visit http://localhost:5173 to use the client application.

## Controls

- **Movement**: Arrow keys or WASD
- **Attack**: Ctrl + Direction key (or Ctrl alone to attack in the current direction)
- **Face**: Alt + Arrow keys/WASD
- **Chat**: Type your message and press Enter

## Connection Instructions

Enter the server address (default: ws://localhost:9001), along with your username and password. Then click Connect & Login to establish the connection with the game server.

## Troubleshooting

- **Connection Issues**: Ensure the proxy server is running before starting the client.
- **Packet Errors**: Verify that both the client and proxy are using compatible protocol versions.
- **Other Issues**: Check the browser's developer console (F12) for error messages.

## Project Structure

- **src/core/**: Core application functionality
- **src/network/**: Network-related modules
- **src/ui/**: User interface components
- **src/main.js**: Application entry point

## Feature Overview

- Secure connection to the game server via a proxy
- Character selection and login functionality
- Movement and interaction within the game world
- Integrated chat functionality
