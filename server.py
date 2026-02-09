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
                published INTEGER NOT NULL DEFAULT 0,
                sales INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES products(id)
            )
            """
        )
        columns = {row["name"] for row in conn.execute("PRAGMA table_info(products)")}
        if "sales" not in columns:
            conn.execute("ALTER TABLE products ADD COLUMN sales INTEGER NOT NULL DEFAULT 0")
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
        "sales": row["sales"],
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


@app.route("/api/purchases", methods=["POST"])
def create_purchase() -> Any:
    data = request.get_json(force=True)
    product_id = data.get("product_id")
    quantity = int(data.get("quantity", 1))
    if not product_id or quantity <= 0:
        return jsonify({"error": "invalid purchase"}), 400

    with get_db_connection() as conn:
        product = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        if not product:
            return jsonify({"error": "product not found"}), 404
        if product["stock"] < quantity:
            return jsonify({"error": "out of stock"}), 400

        conn.execute(
            "INSERT INTO purchases (product_id, quantity) VALUES (?, ?)",
            (product_id, quantity),
        )
        conn.execute(
            "UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?",
            (quantity, quantity, product_id),
        )
        conn.commit()
        updated = conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    return jsonify(row_to_dict(updated)), 201


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=8000, debug=True)
