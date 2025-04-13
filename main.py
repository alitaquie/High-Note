from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.routes.routes import router as note_router
from app.routes.lobby import router as lobby_router
from app.routes.auth import router as auth_router, get_current_user
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

# Create a connection manager for WebSockets
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}

    async def connect(self, websocket: WebSocket, lobby_id: str):
        await websocket.accept()
        if lobby_id not in self.active_connections:
            self.active_connections[lobby_id] = []
        self.active_connections[lobby_id].append(websocket)

    def disconnect(self, websocket: WebSocket, lobby_id: str):
        if lobby_id in self.active_connections:
            self.active_connections[lobby_id].remove(websocket)

    async def broadcast(self, message: dict, lobby_id: str):
        if lobby_id in self.active_connections:
            for connection in self.active_connections[lobby_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# Configure CORS to allow requests from both development and production origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001", 
        "http://localhost:3000",
        "https://*cruzhacks2025*.vercel.app",  # For Vercel deployment
        "https://*railway.app"  # For Railway deployment
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(note_router, prefix="/notes", tags=["notes"], dependencies=[Depends(get_current_user)])
app.include_router(lobby_router, prefix="/lobby", tags=["lobby"], dependencies=[Depends(get_current_user)])

# WebSocket endpoint for real-time communication
@app.websocket("/ws/{lobby_id}")
async def websocket_endpoint(websocket: WebSocket, lobby_id: str):
    await manager.connect(websocket, lobby_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast the received message to all connected clients in the same lobby
            await manager.broadcast(data, lobby_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, lobby_id)
        # Notify remaining clients about the disconnect
        await manager.broadcast({"event": "disconnect", "lobby_id": lobby_id}, lobby_id)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
