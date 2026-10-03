import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const db = new Database(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'ecommerce.db'));
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT, price REAL, category TEXT, stock INTEGER, image_url TEXT);
    CREATE TABLE IF NOT EXISTS cart (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, product_id INTEGER, quantity INTEGER DEFAULT 1, FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE);
    CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, order_code TEXT UNIQUE, customer_name TEXT, customer_email TEXT, customer_phone TEXT, shipping_address TEXT, subtotal REAL, tax REAL, shipping_fee REAL, total REAL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, product_name TEXT, unit_price REAL, quantity INTEGER, subtotal REAL, FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE);
  `);

  if (db.prepare('SELECT count(*) as count FROM products').get().count === 0) {
    const items = [
      ['Wireless Headphones', 'Active noise cancellation over-ear headphones', 199.99, 'Electronics', 10, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80'],
      ['Smart Watch', 'OLED touch display smartwatch with fitness tracking', 149.50, 'Electronics', 15, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80'],
      ['Mechanical Keyboard', 'RGB tactile mechanical switches keyboard', 89.99, 'Electronics', 8, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80'],
      ['Organic Cotton Hoodie', 'Ultra-soft fleece casual hoodie', 54.00, 'Fashion', 25, 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&q=80'],
      ['Polarized Sunglasses', 'UV400 protection vintage acetate sunglasses', 38.50, 'Fashion', 20, 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=600&q=80'],
      ['Ceramic Coffee Dripper', 'Pour-over thermal ceramic coffee maker', 29.99, 'Home', 12, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'],
      ['Stainless Steel Bottle', 'Insulated 750ml thermal water flask', 24.99, 'Home', 30, 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80'],
      ['Bluetooth Speaker', 'IPX7 waterproof wireless speaker', 64.99, 'Electronics', 14, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=600&q=80']
    ];
    const stmt = db.prepare('INSERT INTO products (name, description, price, category, stock, image_url) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) stmt.run(...item);
  }
}

export default db;
