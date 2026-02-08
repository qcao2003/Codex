from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "products.db"

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")


def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL,
                image TEXT,
                description TEXT,
                published INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.commit()


def row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "price": row["price"],
        "stock": row["stock"],
        "image": row["image"],
        "description": row["description"],
        "published": bool(row["published"]),
    }


@app.route("/")
def index() -> Any:
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/api/products", methods=["GET"])
def list_products() -> Any:
    with get_db_connection() as conn:
        rows = conn.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    return jsonify([row_to_dict(row) for row in rows])


@app.route("/api/products", methods=["POST"])
def create_product() -> Any:
    data = request.get_json(force=True)
    required = ["name", "price", "stock"]
    if not all(key in data for key in required):
        return jsonify({"error": "missing required fields"}), 400

    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO products (name, price, stock, image, description, published)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                data["name"],
                data["price"],
                data["stock"],
                data.get("image"),
                data.get("description"),
                1 if data.get("published") else 0,
            ),
        )
        conn.commit()
        product_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id: int) -> Any:
    data = request.get_json(force=True)
    with get_db_connection() as conn:
        existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not existing:
            return jsonify({"error": "product not found"}), 404

        conn.execute(
            """
            UPDATE products
            SET name = ?, price = ?, stock = ?, image = ?, description = ?, published = ?
            WHERE id = ?
            """,
            (
                data.get("name", existing["name"]),
                data.get("price", existing["price"]),
                data.get("stock", existing["stock"]),
                data.get("image", existing["image"]),
                data.get("description", existing["description"]),
                1 if data.get("published", existing["published"]) else 0,
                product_id,
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id: int) -> Any:
    with get_db_connection() as conn:
        existing = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not existing:
            return jsonify({"error": "product not found"}), 404
        conn.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
    return jsonify({"status": "deleted"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8000, debug=True)
