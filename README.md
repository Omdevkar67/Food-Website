# 🍕 QuickBite — Food Delivery Web App

A full-stack food delivery application built with **Node.js + Express + MySQL + Vanilla JS**.

---

## 📁 Project Structure

```
foodapp/
├── backend/
│   ├── server.js          ← Express API server
│   └── package.json
└── frontend/
    ├── index.html         ← Single-page app shell
    ├── css/
    │   └── style.css      ← Full UI styling
    └── js/
        └── app.js         ← All frontend logic
```

---

## 🚀 Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MySQL (v8+)

### 2. Database Setup

Open MySQL and run:

```sql
-- Run the food_delivery_system.sql first (from previous project),
-- OR create a fresh database for this app:

DROP DATABASE IF EXISTS foodapp_db;
CREATE DATABASE foodapp_db CHARACTER SET utf8mb4;
USE foodapp_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('user','admin') DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  price DECIMAL(8,2) NOT NULL,
  category VARCHAR(50) DEFAULT 'Main',
  image_emoji VARCHAR(10) DEFAULT '🍽️',
  available BOOLEAN DEFAULT TRUE
);

CREATE TABLE orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('Pending','Confirmed','Preparing','Out for Delivery','Delivered') DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  menu_id INT NOT NULL,
  quantity INT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_id) REFERENCES menu(id)
);

-- Default admin user (password: "password")
INSERT INTO users (name, email, password, role) VALUES
('Admin', 'admin@foodapp.com',
 '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Sample menu items
INSERT INTO menu (item_name, description, price, category, image_emoji) VALUES
('Chicken Biryani','Aromatic basmati rice with tender chicken',249.00,'Rice','🍛'),
('Paneer Butter Masala','Rich creamy paneer in tomato gravy',199.00,'Curry','🧆'),
('Margherita Pizza','Classic tomato base with fresh mozzarella',299.00,'Pizza','🍕'),
('Veg Burger','Crispy patty with lettuce and cheese',149.00,'Burger','🍔'),
('Masala Dosa','Crispy dosa with spiced potato filling',89.00,'South Indian','🫓'),
('Hakka Noodles','Wok-tossed noodles with vegetables',169.00,'Chinese','🍜'),
('Butter Chicken','Tender chicken in silky butter sauce',279.00,'Curry','🍗'),
('Loaded Fries','Crispy fries with cheese and jalapeños',129.00,'Snacks','🍟'),
('Mango Lassi','Chilled yoghurt drink with fresh mango',79.00,'Drinks','🥭'),
('Gulab Jamun','Soft milk dumplings in sugar syrup',69.00,'Dessert','🍮'),
('Veg Biryani','Fragrant rice with seasonal vegetables',199.00,'Rice','🌾'),
('Tandoori Roti','Freshly baked whole wheat bread',29.00,'Breads','🫓');
```

### 3. Configure Database Connection

Edit `backend/server.js` if your MySQL credentials differ:

```js
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',       // ← your MySQL user
  password: '',       // ← your MySQL password (if any)
  database: 'foodapp_db',
});
```

### 4. Install Dependencies & Start

```bash
cd backend
npm install
node server.js
```

### 5. Open the App

Visit: **http://localhost:3000**

---

## 👤 Default Accounts

| Role  | Email                 | Password |
|-------|-----------------------|----------|
| Admin | admin@foodapp.com     | password |
| User  | Register a new account | any      |

---

## 🔌 API Endpoints

| Method | Endpoint          | Auth     | Description            |
|--------|-------------------|----------|------------------------|
| POST   | `/register`       | None     | Create user account    |
| POST   | `/login`          | None     | Login, get JWT token   |
| GET    | `/menu`           | None     | Get all menu items     |
| POST   | `/menu`           | Admin    | Add a menu item        |
| DELETE | `/menu/:id`       | Admin    | Remove a menu item     |
| POST   | `/order`          | User     | Place an order         |
| GET    | `/orders`         | User     | Get orders (own/all)   |
| PATCH  | `/orders/:id/status` | Admin | Update order status  |

---

## 🧰 Tech Stack

| Layer    | Technology                   |
|----------|------------------------------|
| Frontend | HTML5, CSS3, Vanilla JS      |
| Backend  | Node.js, Express.js          |
| Database | MySQL 8 with mysql2 driver   |
| Auth     | JWT (jsonwebtoken) + bcryptjs|
| Fonts    | Fraunces + DM Sans (Google)  |

---

## ✨ Features

- **User auth** — Register/Login with hashed passwords (bcrypt) and JWT sessions
- **Menu browsing** — Category filters, add to cart with quantity controls
- **Cart** — Live qty adjustment, subtotal + delivery fee, place order
- **Order history** — View all past orders with status badges
- **Admin panel** — Add menu items, view all customer orders, update status
- **MySQL JOINs** — Orders query joins `orders`, `order_items`, `menu`, `users`
