# AURENYX BD — Secure E-Commerce with Admin Panel

A complete, self-contained full-stack e-commerce system built with **pure Node.js** (zero npm dependencies required).

---

## 🗂 Project Structure

```
aurenyx-store/
├── server.js              ← Main backend server (Node.js, no deps)
├── package.json
├── db/
│   └── data.json          ← Auto-created JSON database
├── uploads/               ← Product images (auto-created)
├── public/
│   └── index.html         ← Customer-facing store
└── admin/
    ├── login.html         ← Admin login (private)
    └── dashboard.html     ← Admin dashboard (protected)
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v14 or higher (no npm install needed!)

### Run the server

```bash
node server.js
```

That's it. No build step, no dependencies to install.

---

## 🌐 URLs

| URL | Description | Access |
|-----|-------------|--------|
| `http://localhost:3000/` | Customer Store | Public |
| `http://localhost:3000/admin` | Admin Login | Private |
| `http://localhost:3000/admin/dashboard` | Admin Dashboard | Auth required |

---

## 🔐 Default Admin Credentials

| Field | Value |
|-------|-------|
| Admin ID | `admin` |
| Password | `Admin@1234` |

> **Important:** Change the password immediately after first login via Settings → Change Password.

---

## 🛡 Security Features

- **Separate URL** — Admin panel lives at `/admin`, completely separate from the customer store
- **Session-based auth** — HttpOnly cookies, 8-hour TTL, server-side session validation
- **Password hashing** — SHA-256 (upgrade to bcrypt for production)
- **Protected routes** — All `/admin/dashboard` and `/api/admin/*` routes check session validity before responding
- **Rate-limiting** — Login form locks out after 5 failed attempts for 30 seconds
- **No-index meta** — Admin pages have `<meta name="robots" content="noindex, nofollow">` to prevent search engine indexing
- **Session cleanup** — Expired sessions are purged on every new login

---

## 📦 Admin Panel Features

### Products
- ✅ Add new products with full details
- ✅ Edit any product's information
- ✅ Delete products (with confirmation dialog)
- ✅ Upload product images (drag & drop or click to browse)
- ✅ OR use image URLs (from external sources)
- ✅ Set regular price + optional sale/discounted price
- ✅ Live price preview showing exactly what customers see
- ✅ Stock quantity management
- ✅ Category & badge assignment
- ✅ Search & filter product catalog

### Dashboard
- Live stats (total products, inventory value, low stock, on-sale count)
- Recent products table at a glance

### Settings
- Change admin password
- Store URL info

---

## 🧑‍💻 API Reference

All admin API routes require a valid session cookie.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/products` | Public | List all products |
| `GET` | `/api/products/:id` | Public | Get single product |
| `POST` | `/api/admin/login` | — | Login (returns session cookie) |
| `POST` | `/api/admin/logout` | Required | Logout |
| `GET` | `/api/admin/check` | — | Check session validity |
| `POST` | `/api/admin/products` | Required | Create product (multipart/form-data) |
| `PUT` | `/api/admin/products/:id` | Required | Update product |
| `DELETE` | `/api/admin/products/:id` | Required | Delete product |
| `GET` | `/api/admin/stats` | Required | Dashboard statistics |
| `POST` | `/api/admin/change-password` | Required | Change admin password |

---

## 🗄 Database

Products are stored in `db/data.json` — a simple JSON file acting as a lightweight database. This is ideal for small-to-medium catalogs.

**For production at scale**, swap `loadDB()`/`saveDB()` in `server.js` with:
- **SQLite** via `better-sqlite3`
- **PostgreSQL** via `pg`
- **MongoDB** via `mongoose`

The rest of the code stays the same.

---

## 🌍 Deploying to a Server (e.g. VPS / Hostinger)

1. Upload the entire `aurenyx-store/` folder to your server
2. Install Node.js if not present
3. Run: `node server.js` or use PM2 for production:
   ```bash
   npm install -g pm2
   pm2 start server.js --name aurenyx
   pm2 save
   ```
4. Point your domain/Nginx to port 3000
5. Use Nginx as a reverse proxy (recommended):
   ```nginx
   location / { proxy_pass http://localhost:3000; }
   ```

---

## 🔒 Production Security Checklist

- [ ] Change default admin password immediately
- [ ] Switch from SHA-256 to bcrypt for password hashing
- [ ] Use HTTPS (SSL certificate via Let's Encrypt)
- [ ] Add `Secure` flag to session cookie (requires HTTPS)
- [ ] Move `db/data.json` to a proper database
- [ ] Add input validation/sanitization on all API fields
- [ ] Set `NODE_ENV=production`
