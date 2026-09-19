
import os
import re
import sqlite3
import hashlib
import secrets
import hmac
import uuid

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from starlette.middleware.sessions import SessionMiddleware


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "linksy.db"

# Set LINKSY_SESSION_SECRET in your environment before deployment.
SESSION_SECRET = os.getenv(
    "LINKSY_SESSION_SECRET",
    "dev-only-change-this-secret-before-deployment"
)


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                bio TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        user_columns = connection.execute(
            "PRAGMA table_info(users)"
        ).fetchall()
        if not any(column["name"] == "bio" for column in user_columns):
            connection.execute(
                "ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT ''"
            )
        if not any(column["name"] == "last_seen" for column in user_columns):
            connection.execute(
                "ALTER TABLE users ADD COLUMN last_seen TEXT"
            )

        connection.execute("""
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        columns = connection.execute(
            "PRAGMA table_info(posts)"
        ).fetchall()
        column_names = [column["name"] for column in columns]
        if "image_url" not in column_names:
            connection.execute(
                "ALTER TABLE posts ADD COLUMN image_url TEXT"
            )

        connection.execute("""
            CREATE TABLE IF NOT EXISTS likes (
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, post_id),
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (post_id) REFERENCES posts(id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                post_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (post_id) REFERENCES posts(id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS friend_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'declined')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(sender_id, receiver_id),
                CHECK (sender_id != receiver_id),
                FOREIGN KEY(sender_id) REFERENCES users(id),
                FOREIGN KEY(receiver_id) REFERENCES users(id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                actor_id INTEGER NOT NULL,
                notification_type TEXT NOT NULL
                    CHECK (
                        notification_type IN (
                            'friend_request',
                            'friend_accepted'
                        )
                    ),
                related_id INTEGER,
                is_read INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(actor_id) REFERENCES users(id)
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_read INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY(sender_id) REFERENCES users(id),
                FOREIGN KEY(receiver_id) REFERENCES users(id),
                CHECK(sender_id != receiver_id)
            )
        """)

        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_messages_conversation
            ON messages(sender_id, receiver_id, created_at)
        """)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="Linksy API",
    description="Backend API for the Linksy social network",
    version="1.0.0",
    lifespan=lifespan
)

UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/uploads",
    StaticFiles(directory=UPLOAD_DIR),
    name="uploads",
)

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=False  # Set True when deployed with HTTPS.
)

# Development-only CORS configuration.
# Restrict this to your deployed frontend origin before production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class RegisterInput(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PostInput(BaseModel):
    content: str = Field(default="", max_length=5000)


class CommentInput(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class ProfileInput(BaseModel):
    bio: str = Field(default="", max_length=300)


class FriendRequestInput(BaseModel):
    receiver_id: int


class MessageInput(BaseModel):
    content: str = Field(min_length=1, max_length=2000)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        310_000
    )
    return f"{salt.hex()}:{derived_key.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":")
        salt = bytes.fromhex(salt_hex)
        expected_key = bytes.fromhex(key_hex)
    except (ValueError, TypeError):
        return False

    actual_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        310_000
    )

    return hmac.compare_digest(actual_key, expected_key)


def get_user_by_email(email: str):
    with get_connection() as connection:
        return connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.lower(),)
        ).fetchone()


def get_current_user(request: Request):
    user_id = request.session.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Please log in first."
        )

    with get_connection() as connection:
        user = connection.execute(
            "SELECT id, name, email, created_at FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

    if user is None:
        request.session.clear()
        raise HTTPException(
            status_code=401,
            detail="User account not found."
        )

    return dict(user)


@app.get("/")
def home():
    return {
        "message": "Welcome to the Linksy API",
        "status": "running"
    }


@app.post("/api/register", status_code=201)
def register(data: RegisterInput):
    name = data.name.strip()
    email = str(data.email).lower()

    if len(name) < 2:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid name."
        )

    if get_user_by_email(email):
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    password_hash = hash_password(data.password)

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (name, email, password_hash)
                VALUES (?, ?, ?)
                """,
                (name, email, password_hash)
            )
            user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists."
        )

    return {
        "message": "Account created successfully.",
        "user": {
            "id": user_id,
            "name": name,
            "email": email
        }
    }


@app.post("/api/login")
def login(data: LoginInput, request: Request):
    email = str(data.email).lower()
    user = get_user_by_email(email)

    if not user or not verify_password(
        data.password,
        user["password_hash"]
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    request.session.clear()
    request.session["user_id"] = user["id"]

    return {
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"]
        }
    }


@app.post("/api/logout")
def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully."}


@app.get("/api/me")
def get_profile(request: Request):
    return {"user": get_current_user(request)}


@app.get("/api/profile")
def get_profile_details(request: Request):
    user = get_current_user(request)

    with get_connection() as connection:
        profile = connection.execute("""
            SELECT id, name, email, bio, created_at
            FROM users
            WHERE id = ?
        """, (user["id"],)).fetchone()

    return dict(profile)


@app.put("/api/profile")
def update_profile(data: ProfileInput, request: Request):
    user = get_current_user(request)
    bio = data.bio.strip()

    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET bio = ? WHERE id = ?",
            (bio, user["id"])
        )
        profile = connection.execute("""
            SELECT id, name, email, bio, created_at
            FROM users
            WHERE id = ?
        """, (user["id"],)).fetchone()

    return dict(profile)


@app.post("/api/friends/request")
def send_friend_request(
    data: FriendRequestInput,
    current_user=Depends(get_current_user),
):
    if data.receiver_id == current_user["id"]:
        raise HTTPException(
            status_code=400,
            detail="You cannot send a friend request to yourself.",
        )

    with get_connection() as connection:
        receiver = connection.execute(
            "SELECT id FROM users WHERE id = ?",
            (data.receiver_id,),
        ).fetchone()

        if not receiver:
            raise HTTPException(status_code=404, detail="User not found.")

        existing = connection.execute(
            """
            SELECT id, status FROM friend_requests
            WHERE (sender_id = ? AND receiver_id = ?)
               OR (sender_id = ? AND receiver_id = ?)
            """,
            (
                current_user["id"], data.receiver_id,
                data.receiver_id, current_user["id"],
            ),
        ).fetchone()

        if existing:
            if existing["status"] == "accepted":
                raise HTTPException(status_code=409, detail="You are already friends.")

            if existing["status"] == "pending":
                raise HTTPException(
                    status_code=409,
                    detail="A friend request is already pending.",
                )

            connection.execute(
                """
                UPDATE friend_requests
                SET sender_id = ?, receiver_id = ?,
                    status = 'pending', created_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (current_user["id"], data.receiver_id, existing["id"]),
            )
            request_id = existing["id"]
        else:
            cursor = connection.execute(
                """
                INSERT INTO friend_requests (sender_id, receiver_id)
                VALUES (?, ?)
                """,
                (current_user["id"], data.receiver_id),
            )
            request_id = cursor.lastrowid

        connection.execute(
            """
            INSERT INTO notifications (
                user_id, actor_id, notification_type, related_id
            )
            VALUES (?, ?, 'friend_request', ?)
            """,
            (data.receiver_id, current_user["id"], request_id),
        )

    return {"message": "Friend request sent."}


@app.get("/api/friends/requests")
def get_friend_requests(current_user=Depends(get_current_user)):
    with get_connection() as connection:
        incoming = connection.execute(
            """
            SELECT fr.id, fr.sender_id, u.name, u.email, fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.sender_id
            WHERE fr.receiver_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()

        outgoing = connection.execute(
            """
            SELECT fr.id, fr.receiver_id, u.name, u.email, fr.created_at
            FROM friend_requests fr
            JOIN users u ON u.id = fr.receiver_id
            WHERE fr.sender_id = ? AND fr.status = 'pending'
            ORDER BY fr.created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()

    return {
        "incoming": [dict(row) for row in incoming],
        "outgoing": [dict(row) for row in outgoing],
    }


@app.post("/api/friends/requests/{request_id}/respond")
def respond_to_friend_request(
    request_id: int,
    action: str,
    current_user=Depends(get_current_user),
):
    if action not in ("accept", "decline"):
        raise HTTPException(
            status_code=400,
            detail="Action must be accept or decline.",
        )

    new_status = "accepted" if action == "accept" else "declined"

    with get_connection() as connection:
        request = connection.execute(
            """
            SELECT id, sender_id FROM friend_requests
            WHERE id = ? AND receiver_id = ? AND status = 'pending'
            """,
            (request_id, current_user["id"]),
        ).fetchone()

        if not request:
            raise HTTPException(
                status_code=404,
                detail="Pending friend request not found.",
            )

        connection.execute(
            "UPDATE friend_requests SET status = ? WHERE id = ?",
            (new_status, request_id),
        )

        if action == "accept":
            connection.execute(
                """
                INSERT INTO notifications (
                    user_id, actor_id, notification_type, related_id
                )
                VALUES (?, ?, 'friend_accepted', ?)
                """,
                (request["sender_id"], current_user["id"], request_id),
            )

    return {"message": f"Friend request {new_status}."}


@app.get("/api/friends")
def get_friends(current_user=Depends(get_current_user)):
    with get_connection() as connection:
        friends = connection.execute(
            """
            SELECT u.id, u.name, u.email
            FROM friend_requests fr
            JOIN users u
              ON u.id = CASE
                  WHEN fr.sender_id = ? THEN fr.receiver_id
                  ELSE fr.sender_id
              END
            WHERE (fr.sender_id = ? OR fr.receiver_id = ?)
              AND fr.status = 'accepted'
            ORDER BY u.name
            """,
            (
                current_user["id"],
                current_user["id"],
                current_user["id"],
            ),
        ).fetchall()

    return [dict(row) for row in friends]


@app.post("/api/presence/heartbeat")
def presence_heartbeat(current_user=Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        connection.execute(
            "UPDATE users SET last_seen = ? WHERE id = ?",
            (now, current_user["id"]),
        )

    return {"status": "ok", "last_seen": now}


@app.get("/api/presence/friends")
def get_friends_presence(current_user=Depends(get_current_user)):
    user_id = current_user["id"]

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT u.id, u.name, u.email, u.last_seen
            FROM friend_requests fr
            JOIN users u ON u.id = CASE
                WHEN fr.sender_id = ? THEN fr.receiver_id
                ELSE fr.sender_id
            END
            WHERE fr.status = 'accepted'
              AND (fr.sender_id = ? OR fr.receiver_id = ?)
            """,
            (user_id, user_id, user_id),
        ).fetchall()

    now = datetime.now(timezone.utc)
    result = []

    for row in rows:
        last_seen = row["last_seen"]
        online = False

        if last_seen:
            try:
                last_seen_dt = datetime.fromisoformat(last_seen)
                online = (now - last_seen_dt).total_seconds() <= 90
            except ValueError:
                pass

        result.append({
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "online": online,
            "last_seen": last_seen,
        })

    return result


def are_friends(connection, user_a, user_b):
    result = connection.execute(
        """
        SELECT id
        FROM friend_requests
        WHERE status = 'accepted'
          AND (
              (sender_id = ? AND receiver_id = ?)
              OR (sender_id = ? AND receiver_id = ?)
          )
        LIMIT 1
        """,
        (user_a, user_b, user_b, user_a),
    ).fetchone()

    return result is not None


@app.get("/api/messages/{friend_id}")
def get_conversation(
    friend_id: int,
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]

    with get_connection() as connection:
        if not are_friends(connection, user_id, friend_id):
            raise HTTPException(
                status_code=403,
                detail="You can message accepted friends only.",
            )

        messages = connection.execute(
            """
            SELECT
                m.id,
                m.sender_id,
                m.receiver_id,
                m.content,
                m.created_at,
                m.is_read,
                u.name AS sender_name
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE
                (m.sender_id = ? AND m.receiver_id = ?)
                OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at ASC, m.id ASC
            LIMIT 200
            """,
            (user_id, friend_id, friend_id, user_id),
        ).fetchall()

        connection.execute(
            """
            UPDATE messages
            SET is_read = 1
            WHERE sender_id = ?
              AND receiver_id = ?
              AND is_read = 0
            """,
            (friend_id, user_id),
        )

    return [dict(message) for message in messages]


@app.post("/api/messages/{friend_id}")
def send_message(
    friend_id: int,
    data: MessageInput,
    current_user=Depends(get_current_user),
):
    user_id = current_user["id"]
    content = data.content.strip()

    if not content:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    with get_connection() as connection:
        if not are_friends(connection, user_id, friend_id):
            raise HTTPException(
                status_code=403,
                detail="You can message accepted friends only.",
            )

        receiver = connection.execute(
            "SELECT id FROM users WHERE id = ?",
            (friend_id,),
        ).fetchone()

        if not receiver:
            raise HTTPException(status_code=404, detail="Friend not found.")

        connection.execute(
            """
            INSERT INTO messages (sender_id, receiver_id, content)
            VALUES (?, ?, ?)
            """,
            (user_id, friend_id, content),
        )

    return {"message": "Message sent."}


@app.get("/api/messages")
def get_message_inbox(current_user=Depends(get_current_user)):
    user_id = current_user["id"]

    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                CASE
                    WHEN fr.sender_id = ? THEN fr.receiver_id
                    ELSE fr.sender_id
                END AS friend_id,
                u.name AS full_name,
                u.email AS username,
                latest.content AS last_message,
                latest.created_at AS last_message_at,
                latest.sender_id AS last_sender_id,
                (
                    SELECT COUNT(*)
                    FROM messages unread
                    WHERE unread.sender_id = CASE
                        WHEN fr.sender_id = ? THEN fr.receiver_id
                        ELSE fr.sender_id
                    END
                      AND unread.receiver_id = ?
                      AND unread.is_read = 0
                ) AS unread_count
            FROM friend_requests fr
            JOIN users u ON u.id = CASE
                WHEN fr.sender_id = ? THEN fr.receiver_id
                ELSE fr.sender_id
            END
            LEFT JOIN messages latest ON latest.id = (
                SELECT m2.id
                FROM messages m2
                WHERE
                    (m2.sender_id = ? AND m2.receiver_id = CASE
                        WHEN fr.sender_id = ? THEN fr.receiver_id
                        ELSE fr.sender_id
                    END)
                    OR
                    (m2.sender_id = CASE
                        WHEN fr.sender_id = ? THEN fr.receiver_id
                        ELSE fr.sender_id
                    END AND m2.receiver_id = ?)
                ORDER BY m2.created_at DESC, m2.id DESC
                LIMIT 1
            )
            WHERE fr.status = 'accepted'
              AND (fr.sender_id = ? OR fr.receiver_id = ?)
            ORDER BY latest.created_at DESC, latest.id DESC, u.name
            """,
            (
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
                user_id,
            ),
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/users/search")
def search_users(
    q: str = Query(..., min_length=2, max_length=100),
    current_user=Depends(get_current_user),
):
    search_term = f"%{q.strip()}%"

    with get_connection() as connection:
        users = connection.execute(
            """
            SELECT id, name, email
            FROM users
            WHERE id != ?
              AND (name LIKE ? OR email LIKE ?)
            ORDER BY name
            LIMIT 20
            """,
            (current_user["id"], search_term, search_term),
        ).fetchall()

    return [dict(user) for user in users]


@app.get("/api/notifications")
def get_notifications(current_user=Depends(get_current_user)):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                n.id,
                n.notification_type,
                n.related_id,
                n.is_read,
                n.created_at,
                u.name AS actor_name
            FROM notifications n
            JOIN users u ON u.id = n.actor_id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 50
            """,
            (current_user["id"],),
        ).fetchall()

    return [dict(row) for row in rows]


@app.get("/api/notifications/unread-count")
def get_unread_notification_count(
    current_user=Depends(get_current_user),
):
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM notifications
            WHERE user_id = ? AND is_read = 0
            """,
            (current_user["id"],),
        ).fetchone()

    return {"count": row["count"]}


@app.post("/api/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user=Depends(get_current_user),
):
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE notifications
            SET is_read = 1
            WHERE id = ? AND user_id = ?
            """,
            (notification_id, current_user["id"]),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Notification not found.",
            )

    return {"message": "Notification marked as read."}


def get_post_or_404(connection, post_id: int):
    post = connection.execute(
        "SELECT id FROM posts WHERE id = ?",
        (post_id,)
    ).fetchone()

    if post is None:
        raise HTTPException(status_code=404, detail="Post not found.")


@app.get("/api/posts")
def get_posts(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
):
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                p.id,
                p.user_id AS author_id,
                u.name AS author,
                p.content,
                p.image_url,
                p.created_at,
                (
                    SELECT COUNT(*)
                    FROM likes l
                    WHERE l.post_id = p.id
                ) AS likes,
                EXISTS (
                    SELECT 1
                    FROM likes l
                    WHERE l.post_id = p.id
                      AND l.user_id = ?
                ) AS liked
            FROM posts p
            JOIN users u ON u.id = p.user_id
            WHERE
                p.user_id = ?
                OR p.user_id IN (
                    SELECT CASE
                        WHEN fr.sender_id = ? THEN fr.receiver_id
                        ELSE fr.sender_id
                    END
                    FROM friend_requests fr
                    WHERE fr.status = 'accepted'
                      AND (fr.sender_id = ? OR fr.receiver_id = ?)
                )
            ORDER BY p.created_at DESC, p.id DESC
            LIMIT ? OFFSET ?
            """,
            (
                current_user["id"],
                current_user["id"],
                current_user["id"],
                current_user["id"],
                current_user["id"],
                limit,
                offset,
            ),
        ).fetchall()

        posts = []
        for row in rows:
            post = dict(row)
            comments = connection.execute(
                """
                SELECT
                    c.id,
                    c.content,
                    c.created_at,
                    u.name AS author
                FROM comments c
                JOIN users u ON u.id = c.user_id
                WHERE c.post_id = ?
                ORDER BY c.created_at ASC, c.id ASC
                """,
                (post["id"],),
            ).fetchall()

            post["liked"] = bool(post["liked"])
            post["comments"] = [dict(comment) for comment in comments]
            posts.append(post)

    return posts


@app.post("/api/posts", status_code=201)
def create_post(data: PostInput, request: Request):
    user = get_current_user(request)
    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Write something before publishing."
        )

    with get_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO posts (user_id, content)
            VALUES (?, ?)
        """, (user["id"], content))

        post_id = cursor.lastrowid

    return {
        "message": "Post created successfully.",
        "post_id": post_id
    }


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024


@app.post("/api/posts/with-image")
async def create_post_with_image(
    content: str = Form(""),
    image: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    content = content.strip()

    if len(content) > 5000:
        raise HTTPException(
            status_code=400,
            detail="Post text must be 5,000 characters or fewer.",
        )

    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG, and WebP images are allowed.",
        )

    image_data = await image.read(MAX_IMAGE_SIZE + 1)

    if len(image_data) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Image must be 5 MB or smaller.",
        )

    if not image_data:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    valid_signatures = {
        "image/jpeg": image_data.startswith(b"\xff\xd8\xff"),
        "image/png": image_data.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/webp": (
            image_data.startswith(b"RIFF")
            and image_data[8:12] == b"WEBP"
        ),
    }

    if not valid_signatures.get(image.content_type, False):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file does not match its image type.",
        )

    filename = f"{uuid.uuid4().hex}{ALLOWED_IMAGE_TYPES[image.content_type]}"
    destination = UPLOAD_DIR / filename
    destination.write_bytes(image_data)
    image_url = f"/uploads/{filename}"

    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO posts (user_id, content, image_url)
                VALUES (?, ?, ?)
                """,
                (current_user["id"], content, image_url),
            )
            post_id = cursor.lastrowid
    except Exception:
        destination.unlink(missing_ok=True)
        raise

    return {
        "message": "Post created successfully.",
        "post_id": post_id,
        "image_url": image_url,
    }


@app.post("/api/posts/{post_id}/like")
def toggle_like(post_id: int, request: Request):
    user = get_current_user(request)

    with get_connection() as connection:
        get_post_or_404(connection, post_id)

        existing = connection.execute("""
            SELECT 1 FROM likes
            WHERE user_id = ? AND post_id = ?
        """, (user["id"], post_id)).fetchone()

        if existing:
            connection.execute("""
                DELETE FROM likes
                WHERE user_id = ? AND post_id = ?
            """, (user["id"], post_id))
            liked = False
        else:
            connection.execute("""
                INSERT INTO likes (user_id, post_id)
                VALUES (?, ?)
            """, (user["id"], post_id))
            liked = True

        count = connection.execute("""
            SELECT COUNT(*) AS total
            FROM likes WHERE post_id = ?
        """, (post_id,)).fetchone()["total"]

    return {"liked": liked, "likes": count}


@app.post("/api/posts/{post_id}/comments", status_code=201)
def create_comment(
    post_id: int,
    data: CommentInput,
    request: Request
):
    user = get_current_user(request)
    content = data.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Comment cannot be empty."
        )

    with get_connection() as connection:
        get_post_or_404(connection, post_id)

        cursor = connection.execute("""
            INSERT INTO comments (user_id, post_id, content)
            VALUES (?, ?, ?)
        """, (user["id"], post_id, content))

        comment_id = cursor.lastrowid

    return {
        "message": "Comment added successfully.",
        "comment": {
            "id": comment_id,
            "content": content,
            "author": user["name"]
        }
    }


@app.delete("/api/posts/{post_id}")
def delete_post(post_id: int, request: Request):
    user = get_current_user(request)

    with get_connection() as connection:
        post = connection.execute("""
            SELECT user_id FROM posts WHERE id = ?
        """, (post_id,)).fetchone()

        if post is None:
            raise HTTPException(
                status_code=404,
                detail="Post not found."
            )

        if post["user_id"] != user["id"]:
            raise HTTPException(
                status_code=403,
                detail="You can only delete your own posts."
            )

        connection.execute(
            "DELETE FROM comments WHERE post_id = ?",
            (post_id,)
        )
        connection.execute(
            "DELETE FROM likes WHERE post_id = ?",
            (post_id,)
        )
        connection.execute(
            "DELETE FROM posts WHERE id = ?",
            (post_id,)
        )

    return {"message": "Post deleted successfully."}