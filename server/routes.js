import express from 'express';
import db from './db.js';

const router = express.Router();

const getSessionId = (req) => req.headers['x-session-id'] || 'guest-session';

router.get('/products', (req, res) => {
  const { search, category, sort } = req.query;
  let sql = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category && category !== 'All') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (sort === 'price_asc') sql += ' ORDER BY price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY price DESC';
  else if (sort === 'name') sql += ' ORDER BY name ASC';
  else sql += ' ORDER BY id DESC';

  res.json(db.prepare(sql).all(...params));
});

router.get('/categories', (req, res) => {
  const cats = db.prepare('SELECT DISTINCT category FROM products').all().map(c => c.category);
  res.json(['All', ...cats]);
});

router.get('/products/:id', (req, res) => {
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!prod) return res.status(404).json({ error: 'Product not found' });
  res.json(prod);
});

router.get('/cart', (req, res) => {
  const sessionId = getSessionId(req);
  const items = db.prepare(`
    SELECT c.id, c.quantity, c.product_id, p.name, p.price, p.stock, p.image_url, p.category
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.session_id = ?
  `).all(sessionId);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const shippingFee = subtotal > 100 || items.length === 0 ? 0 : 9.99;
  const total = Math.round((subtotal + tax + shippingFee) * 100) / 100;

  res.json({ items, subtotal: Math.round(subtotal * 100) / 100, tax, shippingFee, total });
});

router.post('/cart', (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const sessionId = getSessionId(req);

  const prod = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
  if (!prod || prod.stock <= 0) return res.status(400).json({ error: 'Product is out of stock' });

  const existing = db.prepare('SELECT * FROM cart WHERE session_id = ? AND product_id = ?').get(sessionId, productId);
  const reqQty = existing ? existing.quantity + quantity : quantity;

  if (reqQty > prod.stock) {
    return res.status(400).json({ error: `Only ${prod.stock} items available in stock` });
  }

  if (existing) {
    db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(reqQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart (session_id, product_id, quantity) VALUES (?, ?, ?)').run(sessionId, productId, quantity);
  }
  res.json({ message: 'Added to cart' });
});

router.put('/cart/:id', (req, res) => {
  const { quantity } = req.body;
  const item = db.prepare('SELECT c.*, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ?').get(req.params.id);
  if (!item || quantity > item.stock) return res.status(400).json({ error: 'Stock limit exceeded' });

  db.prepare('UPDATE cart SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
  res.json({ message: 'Cart updated' });
});

router.delete('/cart/:id', (req, res) => {
  db.prepare('DELETE FROM cart WHERE id = ?').run(req.params.id);
  res.json({ message: 'Item removed' });
});

router.delete('/cart', (req, res) => {
  db.prepare('DELETE FROM cart WHERE session_id = ?').run(getSessionId(req));
  res.json({ message: 'Cart cleared' });
});

router.post('/orders', (req, res) => {
  const { customer_name, customer_email, customer_phone, shipping_address } = req.body;
  const sessionId = getSessionId(req);

  const items = db.prepare(`
    SELECT c.quantity, c.product_id, p.name, p.price, p.stock
    FROM cart c JOIN products p ON c.product_id = p.id
    WHERE c.session_id = ?
  `).all(sessionId);

  if (!items.length) return res.status(400).json({ error: 'Cart is empty' });

  for (const item of items) {
    const current = db.prepare('SELECT stock FROM products WHERE id = ?').get(item.product_id);
    if (!current || current.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for "${item.name}". Available: ${current ? current.stock : 0}` });
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const shippingFee = subtotal > 100 ? 0 : 9.99;
  const total = Math.round((subtotal + tax + shippingFee) * 100) / 100;
  const orderCode = `ORD-${Date.now().toString().slice(-6)}`;

  const orderId = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO orders (order_code, customer_name, customer_email, customer_phone, shipping_address, subtotal, tax, shipping_fee, total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderCode, customer_name, customer_email, customer_phone, shipping_address, subtotal, tax, shippingFee, total);
    const id = r.lastInsertRowid;

    for (const item of items) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, item.product_id, item.name, item.price, item.quantity, item.price * item.quantity);

      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart WHERE session_id = ?').run(sessionId);
    return id;
  })();

  res.status(201).json({
    order: db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId),
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId)
  });
});

export default router;
