// MongoDB initialization script

// Create auth database and collections
db = db.getSiblingDB('auth_db');

// Create users collection with indexes
db.createCollection('users');
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });

// Create notes database and collections
db = db.getSiblingDB('notes_db');

// Create notes collection with indexes
db.createCollection('notes');
db.notes.createIndex({ "title": 1 });
db.notes.createIndex({ "created_at": 1 });
db.notes.createIndex({ "user_id": 1 });

// Create lobbies collection with indexes
db.createCollection('lobbies');
db.lobbies.createIndex({ "lobby_name": 1 });
db.lobbies.createIndex({ "created_by": 1 });
db.lobbies.createIndex({ "created_at": 1 });

// Insert a sample admin user
db = db.getSiblingDB('auth_db');
db.users.insertOne({
    username: "admin",
    email: "admin@example.com",
    hashed_password: "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW", // "password"
    is_active: true,
    created_at: new Date()
});

print("MongoDB initialization completed successfully."); 