# Portfolio Socket.IO

Real-time events for the portfolio platform use the **`/portfolio`** namespace on the same server as the REST API.

## Connection (frontend)

- **URL:** same as API base (e.g. `http://localhost:3000` or `BACKEND_API_URL` without `/api/portfolio`).
- **Namespace:** `/portfolio`.
- **Auth:** send the portfolio JWT in the handshake so the server can associate the socket with a user and deliver notifications.

Example (client):

```js
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/portfolio', {
  auth: {
    token: accessToken,  // same JWT as for /api/portfolio/auth/me
  },
  path: '/socket.io',
});

socket.on('connect', () => { /* joined portfolio-user-${userId} */ });
socket.on('notification:new', (notification) => { /* new notification */ });
socket.on('message:new', (message) => { /* new chat message */ });
```

## Events (server → client)

| Event             | When                         | Payload                          |
|------------------|------------------------------|-----------------------------------|
| `notification:new` | New notification for the user | Notification document (object)    |
| `message:new`      | New message in a conversation | Message document (object)         |

## Events (client → server)

| Event               | Payload          | Effect                                      |
|---------------------|------------------|---------------------------------------------|
| `join-conversation` | `conversationId` | Socket joins room for this conversation     |
| `leave-conversation`| `conversationId` | Socket leaves the conversation room         |

To receive `message:new` for a conversation, the client must emit `join-conversation` with that conversation’s ID after connecting.

## Rooms

- **`portfolio-user-${userId}`** – one room per user; server emits `notification:new` here. The server joins the socket to this room when the client connects with a valid token.
- **`portfolio-conversation-${conversationId}`** – one room per chat; server emits `message:new` here. The client must emit `join-conversation` to join.
