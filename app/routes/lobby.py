from fastapi import APIRouter, Depends, HTTPException, Body  # <- Added Body
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from app.db import get_database_client

from bson.objectid import ObjectId
from app.routes.auth import get_current_user
from app.routes.auth import User


router = APIRouter()

class LobbyPayload(BaseModel):
    lobby_name: str
    description: Optional[str] = None
    user_count: int = 1  # Default to 1 for the creator
    password: Optional[str] = None  # Allow an optional password
    created_by: Optional[str] = None  # For compatibility; will use current_user in endpoint
    advanced_settings: Optional[Dict[str, Any]] = None  # Added field for advanced settings

@router.post("/create-lobby")
async def create_lobby(
    payload: LobbyPayload,
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    # Enforce a max word count for description (e.g., 50 words)
    if payload.description:
        word_count = len(payload.description.strip().split())
        if word_count > 50:
            raise HTTPException(
                status_code=400,
                detail=f"Description is too long ({word_count} words). Limit is 50 words."
            )

    async with get_database_client() as client:
        db = client.notes_db
        lobby_data = {
            "lobby_name": payload.lobby_name,
            "created_by": current_user.username,
            "description": payload.description,
            "user_count": payload.user_count,
            "created_at": datetime.utcnow(),
            "password": payload.password,
            "advanced_settings": payload.advanced_settings or {
                "numConceptsStudent": 10,
                "numConceptsClass": 15,
                "similarityThresholdUpdate": 0.75,
                "similarityThresholdAnalyze": 0.8,
            }
        }
        result = await db.lobbies.insert_one(lobby_data)
        if not result.inserted_id:
            raise HTTPException(status_code=500, detail="Failed to create lobby")

        return {"message": "Lobby created successfully", "lobby_id": str(result.inserted_id)}

# Get lobby by ID endpoint with enhanced security
@router.get("/lobbies/{lobby_id}")
async def get_lobby_by_id(
    lobby_id: str,
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        lobby = await db.lobbies.find_one({"_id": ObjectId(lobby_id)})
        if not lobby:
            raise HTTPException(status_code=404, detail="Lobby not found")
            
        # Check if the current user is the creator
        is_creator = lobby.get("created_by") == current_user.username
        
        # Build response object
        response = {
            "lobby_id": str(lobby["_id"]),
            "lobby_name": lobby.get("lobby_name", ""),
            "description": lobby.get("description", ""),
            "user_count": lobby.get("user_count", 0),
            "created_by": lobby.get("created_by", ""),
            "advanced_settings": lobby.get("advanced_settings", {
                "numConceptsStudent": 10,
                "numConceptsClass": 15,
                "similarityThresholdUpdate": 0.75,
                "similarityThresholdAnalyze": 0.8,
            })
        }
        
        # Only include password if the user is the creator
        if is_creator:
            response["password"] = lobby.get("password", None)
            
        return response
@router.get("/lobbies/{lobby_id}/advanced-settings")
async def get_advanced_settings(
    lobby_id: str,
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        lobby = await db.lobbies.find_one({"_id": ObjectId(lobby_id)})
        if not lobby:
            raise HTTPException(status_code=404, detail="Lobby not found")
            
        adv_settings = lobby.get("advanced_settings")
        if not adv_settings:
            raise HTTPException(
                status_code=400, 
                detail="Advanced settings are not available or not fully configured. Please try again later."
            )
        return {"advanced_settings": adv_settings}

# Existing delete endpoint (still present; used elsewhere)
@router.delete("/lobbies/{lobby_id}")
async def delete_lobby(
    lobby_id: str,
    password: str = Body(..., embed=True),
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        lobby = await db.lobbies.find_one({"_id": ObjectId(lobby_id)})

        if not lobby:
            raise HTTPException(status_code=404, detail="Lobby not found")
            
        # Check if current user is the creator of the lobby
        if lobby.get("created_by") != current_user.username:
            raise HTTPException(
                status_code=403, 
                detail="Only the creator of the lobby can delete it"
            )
            
        # Verify the lobby password
        if lobby.get("password") != password:
            raise HTTPException(status_code=403, detail="Incorrect password")

        result = await db.lobbies.delete_one({"_id": ObjectId(lobby_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=500, detail="Lobby deletion failed")

        return {"message": "Lobby deleted successfully"}

@router.get("/lobbies")
async def get_all_lobbies(
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        lobbies_cursor = db.lobbies.find({})
        lobbies = await lobbies_cursor.to_list(length=None)
        return [
            {
                "lobby_id": str(lobby["_id"]),
                "lobby_name": lobby.get("lobby_name", ""),
                "description": lobby.get("description", ""),
                "user_count": lobby.get("user_count", 0),
                "created_by": lobby.get("created_by", ""),
                "created_at": lobby.get("created_at", ""),
                "advanced_settings": lobby.get("advanced_settings", {
                    "numConceptsStudent": 10,
                    "numConceptsClass": 15,
                    "similarityThresholdUpdate": 0.75,
                    "similarityThresholdAnalyze": 0.8,
                })
            }
            for lobby in lobbies
        ]

@router.put("/lobbies/{lobby_id}/increment-user-count")
async def increment_user_count(
    lobby_id: str,
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        result = await db.lobbies.update_one(
            {"_id": ObjectId(lobby_id)},
            {"$inc": {"user_count": 1}}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Lobby not found")
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to increment user count")
        return {"message": "User count incremented successfully"}

@router.put("/lobbies/{lobby_id}/update-settings")
async def update_lobby_settings(
    lobby_id: str,
    settings_data: dict = Body(...),
    current_user: User = Depends(get_current_user),
    db_client: AsyncIOMotorClient = Depends(get_database_client)
):
    async with get_database_client() as client:
        db = client.notes_db
        
        # First check if the lobby exists
        lobby = await db.lobbies.find_one({"_id": ObjectId(lobby_id)})
        if not lobby:
            raise HTTPException(status_code=404, detail="Lobby not found")
        
        # Check if current user is the creator of the lobby
        if lobby.get("created_by") != current_user.username:
            raise HTTPException(
                status_code=403, 
                detail="Only the creator of the lobby can update settings"
            )
        
        # Update only the advanced_settings field
        result = await db.lobbies.update_one(
            {"_id": ObjectId(lobby_id)},
            {"$set": {"advanced_settings": settings_data.get("advanced_settings")}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=500, detail="Failed to update lobby settings")
        
        # Fetch the updated lobby to return
        updated_lobby = await db.lobbies.find_one({"_id": ObjectId(lobby_id)})
        
        return {
            "message": "Lobby settings updated successfully",
            "advanced_settings": updated_lobby.get("advanced_settings")
        }
    