const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const url     = require('url');

const PORT    = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db', 'data.json');
const UPL_DIR = path.join(__dirname, 'uploads');

[path.join(__dirname,'db'), UPL_DIR].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true});
});

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return initDB();
  try { return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch { return initDB(); }
}
function saveDB(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }
function initDB() {
  const data = {
    admin: { id: 'admin', passwordHash: sha256('Admin@1234') },
    sessions: {},
    banner: { imageUrl: '' },
    merchantNumbers: { bkash: '01XXXXXXXXX', nagad: '01XXXXXXXXX', rocket: '01XXXXXXXXX' },
    orders: [],
    products: [
      { id: pid(), brand:'Tissot', name:'Seastar 1000 Powermatic 80', desc:'Swiss automatic dive watch. Ceramic bezel, sapphire crystal, 300m water resistance.', category:'dive', regularPrice:89500, salePrice:null, badge:'hot', image:'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=600&q=80', stock:7, createdAt:Date.now() },
      { id: pid(), brand:'Fossil', name:'FB-01 Chronograph', desc:'Bold sport chronograph with tachymeter bezel and three sub-dials.', category:'chrono', regularPrice:38900, salePrice:null, badge:null, image:'https://images.unsplash.com/photo-1547996160-81dfa63595aa?w=600&q=80', stock:14, createdAt:Date.now() },
      { id: pid(), brand:'Seiko', name:'Presage Sharp Edge', desc:'Japanese craftsmanship meets modern automatic movement. Textured enamel dial.', category:'dress', regularPrice:54500, salePrice:null, badge:'new', image:'https://images.unsplash.com/photo-1526045612212-70caf35c14df?w=600&q=80', stock:5, createdAt:Date.now() },
      { id: pid(), brand:'Orient', name:'Bambino Classic V', desc:'Timeless dress watch with in-house Orient automatic movement.', category:'dress', regularPrice:19500, salePrice:null, badge:null, image:'https://images.unsplash.com/photo-1545243424-0ce743213a82?w=600&q=80', stock:18, createdAt:Date.now() },
      { id: pid(), brand:'Hamilton', name:'Khaki Field Auto', desc:'Military-inspired field watch with H-10 movement offering 80-hour power reserve.', category:'automatic', regularPrice:49500, salePrice:null, badge:null, image:'https://images.unsplash.com/photo-1548171916-c8fd5d17b15a?w=600&q=80', stock:11, createdAt:Date.now() },
      { id: pid(), brand:'Certina', name:'DS Action Diver', desc:'Swiss precision diver with Powermatic 80. Ceramic unidirectional bezel.', category:'dive', regularPrice:68000, salePrice:55000, badge:'sale', image:'https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=600&q=80', stock:4, createdAt:Date.now() },
      { id: pid(), brand:'Seiko', name:'5 Sports Fieldmaster', desc:'The legendary Seiko 5 reimagined. Tough automatic movement, bold dial design.', category:'automatic', regularPrice:24900, salePrice:null, badge:null, image:'https://images.unsplash.com/photo-1617043786394-f977fa12eddf?w=600&q=80', stock:22, createdAt:Date.now() },
      { id: pid(), brand:'Longines', name:'HydroConquest Auto', desc:'Swiss luxury diver. Ceramic bezel, anti-reflective sapphire, 300m water resistance.', category:'dive', regularPrice:142000, salePrice:119000, badge:'sale', image:'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&q=80', stock:3, createdAt:Date.now() },
    ]
  };
  saveDB(data); return data;
}
function pid() { return crypto.randomBytes(8).toString('hex'); }
function sha256(str) { return crypto.createHash('sha256').update(str).digest('hex'); }

const SESSION_TTL = 8 * 60 * 60 * 1000;
function createSession() {
  const db = loadDB();
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[token] = { createdAt: Date.now() };
  for (const [t, s] of Object.entries(db.sessions)) { if (Date.now() - s.createdAt > SESSION_TTL) delete db.sessions[t]; }
  saveDB(db); return token;
}
function validSession(req) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/adminToken=([a-f0-9]{64})/);
  if (!match) return false;
  const db = loadDB(); const s = db.sessions[match[1]];
  return s && (Date.now() - s.createdAt < SESSION_TTL);
}
function destroySession(req) {
  const cookie = req.headers.cookie || '';
  const match  = cookie.match(/adminToken=([a-f0-9]{64})/);
  if (!match) return;
  const db = loadDB(); delete db.sessions[match[1]]; saveDB(db);
}

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(.+)$/);
    if (!bm) return reject(new Error('No boundary'));
    const boundary = '--' + bm[1];
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const fields = {}, files = {};
      const parts = splitBuffer(body, Buffer.from('\r\n' + boundary));
      parts.forEach(part => {
        const he = part.indexOf('\r\n\r\n'); if (he === -1) return;
        const hdr = part.slice(0, he).toString();
        const dat = part.slice(he + 4);
        const nm = hdr.match(/name="([^"]+)"/);
        const fm = hdr.match(/filename="([^"]+)"/);
        if (!nm) return;
        if (fm && fm[1]) { const cm = hdr.match(/Content-Type:\s*(.+)/i); files[nm[1]] = { filename: fm[1], mimetype: cm ? cm[1].trim() : 'application/octet-stream', data: dat }; }
        else { fields[nm[1]] = dat.toString().replace(/\r\n$/, ''); }
      });
      resolve({ fields, files });
    });
    req.on('error', reject);
  });
}
function splitBuffer(buf, delimiter) {
  const parts = []; let start = 0, pos = 0;
  while (pos <= buf.length - delimiter.length) {
    let match = true;
    for (let i = 0; i < delimiter.length; i++) { if (buf[pos+i] !== delimiter[i]) { match = false; break; } }
    if (match) { parts.push(buf.slice(start, pos)); pos += delimiter.length; if (buf[pos] === 13 && buf[pos+1] === 10) pos += 2; start = pos; } else { pos++; }
  }
  if (start < buf.length) parts.push(buf.slice(start));
  return parts.filter(p => p.length > 2);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
    req.on('error', reject);
  });
}
function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': contentType}); res.end(data);
  });
}
const MIME = { '.html':'text/html','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2' };
function jsonOk(res, data)       { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(data)); }
function jsonErr(res, msg, code=400) { res.writeHead(code,{'Content-Type':'application/json'}); res.end(JSON.stringify({error:msg})); }

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method.toUpperCase();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (pathname.startsWith('/uploads/')) {
    const imgPath = path.join(UPL_DIR, path.basename(pathname));
    const ext = path.extname(imgPath).toLowerCase();
    serveFile(res, imgPath, MIME[ext] || 'application/octet-stream'); return;
  }
  if (pathname === '/' || pathname === '/index.html') { serveFile(res, path.join(__dirname, 'public', 'index.html'), 'text/html'); return; }
  if (pathname === '/admin' || pathname === '/admin/') {
    if (validSession(req)) { res.writeHead(302, { Location: '/admin/dashboard' }); res.end(); return; }
    serveFile(res, path.join(__dirname, 'admin', 'login.html'), 'text/html'); return;
  }
  if (pathname === '/admin/dashboard') {
    if (!validSession(req)) { res.writeHead(302, { Location: '/admin' }); res.end(); return; }
    serveFile(res, path.join(__dirname, 'admin', 'dashboard.html'), 'text/html'); return;
  }

  if (pathname === '/api/admin/login' && method === 'POST') {
    const body = await readBody(req); const db = loadDB();
    if (body.adminId === db.admin.id && sha256(body.password) === db.admin.passwordHash) {
      const token = createSession();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': `adminToken=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800` });
      res.end(JSON.stringify({ ok: true }));
    } else { jsonErr(res, 'Invalid credentials', 401); }
    return;
  }
  if (pathname === '/api/admin/logout' && method === 'POST') {
    destroySession(req);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'adminToken=; Path=/; HttpOnly; Max-Age=0' });
    res.end(JSON.stringify({ ok: true })); return;
  }
  if (pathname === '/api/admin/check') { jsonOk(res, { ok: validSession(req) }); return; }

  // Public
  if (pathname === '/api/products' && method === 'GET') { const db = loadDB(); jsonOk(res, db.products.sort((a,b)=>b.createdAt-a.createdAt)); return; }
  if (pathname.match(/^\/api\/products\/[a-f0-9]+$/) && method === 'GET') {
    const id = pathname.split('/').pop(); const db = loadDB(); const p = db.products.find(x=>x.id===id);
    p ? jsonOk(res,p) : jsonErr(res,'Product not found',404); return;
  }
  if (pathname === '/api/banner' && method === 'GET') { const db = loadDB(); jsonOk(res, db.banner || {imageUrl:''}); return; }
  if (pathname === '/api/settings' && method === 'GET') { const db = loadDB(); jsonOk(res, { merchantNumbers: db.merchantNumbers || {bkash:'',nagad:'',rocket:''} }); return; }

  if (pathname === '/api/orders' && method === 'POST') {
    const ct = req.headers['content-type'] || '';
    let fields = {}, files = {};
    if (ct.includes('multipart/form-data')) { const p = await parseMultipart(req); fields = p.fields; files = p.files; }
    else { fields = await readBody(req); }
    let screenshotUrl = '';
    if (files.screenshot && files.screenshot.data.length > 0) {
      const ext = path.extname(files.screenshot.filename) || '.jpg';
      const fname = 'order-' + pid() + ext;
      fs.writeFileSync(path.join(UPL_DIR, fname), files.screenshot.data);
      screenshotUrl = '/uploads/' + fname;
    }
    const db = loadDB();
    const order = {
      id: 'AUR-' + Date.now().toString(36).toUpperCase(),
      customerName:(fields.customerName||'').trim(), phone:(fields.phone||'').trim(),
      address:(fields.address||'').trim(), paymentMethod:(fields.paymentMethod||'').trim(),
      paymentNumber:(fields.paymentNumber||'').trim(), transactionId:(fields.transactionId||'').trim(),
      screenshotUrl, items:JSON.parse(fields.items||'[]'), totalAmount:parseFloat(fields.totalAmount)||0,
      status:'pending', createdAt:Date.now()
    };
    if (!db.orders) db.orders = [];
    db.orders.push(order); saveDB(db); jsonOk(res, { ok: true, orderId: order.id }); return;
  }

  const requireAdmin = () => { if (!validSession(req)) { jsonErr(res,'Unauthorized',401); return false; } return true; };

  if (pathname === '/api/admin/banner' && method === 'POST') {
    if (!requireAdmin()) return;
    const ct = req.headers['content-type'] || '';
    let fields = {}, files = {};
    if (ct.includes('multipart/form-data')) { const p = await parseMultipart(req); fields = p.fields; files = p.files; }
    else { fields = await readBody(req); }
    let imageUrl = fields.imageUrl || '';
    if (files.banner && files.banner.data.length > 0) {
      const ext = path.extname(files.banner.filename) || '.jpg';
      const fname = 'banner-' + pid() + ext;
      fs.writeFileSync(path.join(UPL_DIR, fname), files.banner.data);
      imageUrl = '/uploads/' + fname;
    }
    const db = loadDB(); db.banner = { imageUrl }; saveDB(db); jsonOk(res, { ok:true, imageUrl }); return;
  }

  if (pathname === '/api/admin/settings' && method === 'POST') {
    if (!requireAdmin()) return;
    const body = await readBody(req); const db = loadDB();
    db.merchantNumbers = { bkash:(body.bkash||'').trim(), nagad:(body.nagad||'').trim(), rocket:(body.rocket||'').trim() };
    saveDB(db); jsonOk(res, { ok:true }); return;
  }

  if (pathname === '/api/admin/orders' && method === 'GET') {
    if (!requireAdmin()) return;
    const db = loadDB(); jsonOk(res, (db.orders||[]).sort((a,b)=>b.createdAt-a.createdAt)); return;
  }
  if (pathname.match(/^\/api\/admin\/orders\/AUR-[A-Z0-9]+$/) && method === 'PUT') {
    if (!requireAdmin()) return;
    const id = pathname.split('/').pop(); const body = await readBody(req);
    const db = loadDB(); const idx = db.orders.findIndex(x=>x.id===id);
    if (idx===-1) { jsonErr(res,'Not found',404); return; }
    db.orders[idx].status = body.status || db.orders[idx].status; saveDB(db); jsonOk(res, db.orders[idx]); return;
  }

  if (pathname === '/api/admin/products' && method === 'POST') {
    if (!requireAdmin()) return;
    const ct = req.headers['content-type'] || '';
    let fields = {}, files = {};
    if (ct.includes('multipart/form-data')) { const p = await parseMultipart(req); fields = p.fields; files = p.files; }
    else { fields = await readBody(req); }
    let imageUrl = fields.imageUrl || '';
    if (files.image && files.image.data.length > 0) { const ext = path.extname(files.image.filename)||'.jpg'; const fname = pid()+ext; fs.writeFileSync(path.join(UPL_DIR,fname),files.image.data); imageUrl='/uploads/'+fname; }
    const db = loadDB();
    const product = { id:pid(), brand:(fields.brand||'').trim(), name:(fields.name||'').trim(), desc:(fields.desc||'').trim(), category:(fields.category||'other').trim(), regularPrice:parseFloat(fields.regularPrice)||0, salePrice:fields.salePrice?parseFloat(fields.salePrice):null, badge:fields.badge||null, image:imageUrl, stock:parseInt(fields.stock)||0, createdAt:Date.now() };
    db.products.push(product); saveDB(db); jsonOk(res, product); return;
  }
  if (pathname.match(/^\/api\/admin\/products\/[a-f0-9]+$/) && method === 'PUT') {
    if (!requireAdmin()) return;
    const id = pathname.split('/').pop();
    const ct = req.headers['content-type'] || '';
    let fields = {}, files = {};
    if (ct.includes('multipart/form-data')) { const p = await parseMultipart(req); fields = p.fields; files = p.files; }
    else { fields = await readBody(req); }
    const db = loadDB(); const idx = db.products.findIndex(x=>x.id===id);
    if (idx===-1) { jsonErr(res,'Not found',404); return; }
    const ex = db.products[idx];
    let imageUrl = fields.imageUrl || ex.image;
    if (files.image && files.image.data.length > 0) { const ext = path.extname(files.image.filename)||'.jpg'; const fname = pid()+ext; fs.writeFileSync(path.join(UPL_DIR,fname),files.image.data); imageUrl='/uploads/'+fname; }
    db.products[idx] = { ...ex, brand:(fields.brand||ex.brand).trim(), name:(fields.name||ex.name).trim(), desc:(fields.desc||ex.desc).trim(), category:fields.category||ex.category, regularPrice:fields.regularPrice?parseFloat(fields.regularPrice):ex.regularPrice, salePrice:fields.salePrice===''?null:(fields.salePrice?parseFloat(fields.salePrice):ex.salePrice), badge:fields.badge===''?null:(fields.badge||ex.badge), image:imageUrl, stock:fields.stock!==undefined?parseInt(fields.stock):ex.stock, updatedAt:Date.now() };
    saveDB(db); jsonOk(res, db.products[idx]); return;
  }
  if (pathname.match(/^\/api\/admin\/products\/[a-f0-9]+$/) && method === 'DELETE') {
    if (!requireAdmin()) return;
    const id = pathname.split('/').pop(); const db = loadDB(); const idx = db.products.findIndex(x=>x.id===id);
    if (idx===-1) { jsonErr(res,'Not found',404); return; }
    db.products.splice(idx,1); saveDB(db); jsonOk(res,{ok:true}); return;
  }
  if (pathname === '/api/admin/change-password' && method === 'POST') {
    if (!requireAdmin()) return;
    const body = await readBody(req); const db = loadDB();
    if (sha256(body.currentPassword) !== db.admin.passwordHash) { jsonErr(res,'Current password is incorrect',400); return; }
    if (!body.newPassword || body.newPassword.length < 6) { jsonErr(res,'Password must be at least 6 characters',400); return; }
    db.admin.passwordHash = sha256(body.newPassword); saveDB(db); jsonOk(res,{ok:true}); return;
  }
  if (pathname === '/api/admin/stats') {
    if (!requireAdmin()) return;
    const db = loadDB();
    jsonOk(res, { totalProducts:db.products.length, totalValue:db.products.reduce((s,p)=>s+p.regularPrice*p.stock,0), lowStock:db.products.filter(p=>p.stock<=5).length, onSale:db.products.filter(p=>p.salePrice).length, totalOrders:(db.orders||[]).length, pendingOrders:(db.orders||[]).filter(o=>o.status==='pending').length }); return;
  }

  res.writeHead(404,{'Content-Type':'text/plain'}); res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║        AURENYX BD — SERVER RUNNING           ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Store:      http://localhost:${PORT}             ║`);
  console.log(`║  Admin:      http://localhost:${PORT}/admin       ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  Admin ID:   admin  |  Password: Admin@1234  ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
