const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'foodapp_secret_key_2024';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// DB connection pool
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'root',
  password: 'aditya', // ⚠️ PUT YOUR MYSQL PASSWORD
  database: 'foodapp_db',
  port: 3307 // ⚠️ UPDATE IF YOUR MYSQL RUNS ON DIFFERENT PORT,
});

// ✅ DB CHECK
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ MySQL Connected");
    conn.release();
  } catch (err) {
    console.log("❌ DB Error:", err.message);
  }
})();

// ── Auth middleware ─────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function adminMiddleware(req, res, next) {
  authMiddleware(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    next();
  });
}

// ── Routes ─────────────────────────────────────

// POST /register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields required' });

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    const token = jwt.sign({ id: result.insertId, name, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.insertId, name, email, role: 'user' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /menu
app.get('/menu', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM menu ORDER BY category, item_name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /menu  (admin only)
app.post('/menu', adminMiddleware, async (req, res) => {
  try {
    const { item_name, description, price, category, image_emoji } = req.body;
    if (!item_name || !price) return res.status(400).json({ error: 'item_name and price required' });
    const [result] = await db.query(
      'INSERT INTO menu (item_name, description, price, category, image_emoji) VALUES (?, ?, ?, ?, ?)',
      [item_name, description || '', price, category || 'Main', image_emoji || '🍽️']
    );
    const [rows] = await db.query('SELECT * FROM menu WHERE id = ?', [result.insertId]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /menu/:id  (admin only)
app.delete('/menu/:id', adminMiddleware, async (req, res) => {
  try {
    await db.query('UPDATE menu SET available = FALSE WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /order  (place order)
app.post('/order', authMiddleware, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { items } = req.body; // [{menu_id, quantity}, ...]
    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });

    // Calculate total
    const ids = items.map(i => i.menu_id);
    const [menuRows] = await conn.query(
      'SELECT id, price FROM menu WHERE id IN (?) AND available = TRUE', [ids]
    );
    const priceMap = Object.fromEntries(menuRows.map(m => [m.id, parseFloat(m.price)]));
    let total = 0;
    for (const item of items) {
      if (!priceMap[item.menu_id]) throw new Error(`Item ${item.menu_id} not available`);
      total += priceMap[item.menu_id] * item.quantity;
    }

    const [orderResult] = await conn.query(
      'INSERT INTO orders (user_id, total_amount) VALUES (?, ?)',
      [req.user.id, total]
    );
    const orderId = orderResult.insertId;

    for (const item of items) {
      await conn.query(
        'INSERT INTO order_items (order_id, menu_id, quantity) VALUES (?, ?, ?)',
        [orderId, item.menu_id, item.quantity]
      );
    }

    await conn.commit();
    res.json({ success: true, order_id: orderId, total });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// GET /orders  – user gets own orders, admin gets all
app.get('/orders', authMiddleware, async (req, res) => {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = `
        SELECT o.id, o.total_amount, o.status, o.created_at,
               u.name AS customer_name, u.email,
               GROUP_CONCAT(CONCAT(m.item_name,' x',oi.quantity) SEPARATOR ', ') AS items
        FROM orders o
        JOIN users u ON u.id = o.user_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu m ON m.id = oi.menu_id
        GROUP BY o.id ORDER BY o.created_at DESC`;
      params = [];
    } else {
      query = `
        SELECT o.id, o.total_amount, o.status, o.created_at,
               GROUP_CONCAT(CONCAT(m.item_name,' x',oi.quantity) SEPARATOR ', ') AS items
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN menu m ON m.id = oi.menu_id
        WHERE o.user_id = ?
        GROUP BY o.id ORDER BY o.created_at DESC`;
      params = [req.user.id];
    }
    const [rows] = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /orders/:id/status  (admin only)
app.patch('/orders/:id/status', adminMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catch-all → serve index.html
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`🍕 Food App running at http://localhost:${PORT}`);
});
