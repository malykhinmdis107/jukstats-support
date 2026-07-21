require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

let db = null;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
} catch(e) { console.error('Firebase error:', e.message); }

app.get('/', (req, res) => res.json({ status: 'support-api' }));

// ===== ТИКЕТЫ =====
app.get('/api/support/tickets', async (req, res) => {
  if (!db) return res.json([]);
  try {
    let tickets = [];
    if (req.query.accountId) {
      const snap = await db.collection('support')
        .orderBy('time', 'desc').get();
      snap.forEach(doc => {
        const data = doc.data();
        if (String(data.accountId) === String(req.query.accountId)) {
          tickets.push({ id: doc.id, ...data });
        }
      });
    } else {
      const snap = await db.collection('support')
        .orderBy('time', 'desc').limit(100).get();
      snap.forEach(doc => tickets.push({ id: doc.id, ...doc.data() }));
    }
    res.json(tickets);
  } catch(e) { res.json([]); }
});

app.post('/api/support/ticket', async (req, res) => {
  if (!db) return res.json({ success: false });
  try {
    const ticket = {
      user: String(req.body.user || 'Аноним'),
      accountId: parseInt(req.body.accountId) || req.body.accountId,
      category: String(req.body.category || 'Обращение'),
      message: String(req.body.message || ''),
      status: 'pending',
      time: Number(req.body.time) || Date.now()
    };
    const docRef = await db.collection('support').add(ticket);
    res.json({ success: true, id: docRef.id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/support/ticket/:ticketId', async (req, res) => {
  if (!db) return res.json({ success: false });
  try {
    const updateData = {};
    if (req.body.status) updateData.status = String(req.body.status);
    if (req.body.adminReply) updateData.adminReply = String(req.body.adminReply);
    if (req.body.adminName) updateData.adminName = String(req.body.adminName);
    if (req.body.adminId) updateData.adminId = parseInt(req.body.adminId) || req.body.adminId;
    if (req.body.updatedAt) updateData.updatedAt = Number(req.body.updatedAt);
    await db.collection('support').doc(req.params.ticketId).update(updateData);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ===== ПОРОГИ ОТМЕТОК =====
app.get('/api/thresholds/:tankId', async (req, res) => {
  if (!db) return res.json({ admin: {} });
  try {
    const doc = await db.collection('tankThresholds').doc(req.params.tankId).get();
    res.json(doc.exists ? doc.data() : { admin: { mark1: null, mark2: null, mark3: null } });
  } catch(e) { res.json({ admin: {} }); }
});

app.post('/api/thresholds/:tankId', async (req, res) => {
  if (!db) return res.json({ success: false });
  try {
    const { mark1, mark2, mark3 } = req.body;
    await db.collection('tankThresholds').doc(req.params.tankId).set({
      admin: {
        mark1: mark1 !== null ? Number(mark1) : null,
        mark2: mark2 !== null ? Number(mark2) : null,
        mark3: mark3 !== null ? Number(mark3) : null
      }
    }, { merge: true });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/thresholds-list', async (req, res) => {
  if (!db) return res.json({});
  try {
    const snap = await db.collection('tankThresholds').get();
    const thresholds = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data.admin) thresholds[doc.id] = data.admin;
    });
    res.json(thresholds);
  } catch(e) { res.json({}); }
});

app.get('/api/admin/check-level', async (req, res) => {
  if (!db) return res.json({ level: 0 });
  try {
    const accountId = parseInt(req.query.accountId);
    if (!accountId) return res.json({ level: 0 });
    const doc = await db.collection('admin_levels').doc(String(accountId)).get();
    res.json({ level: doc.exists ? (doc.data().level || 0) : 0 });
  } catch(e) { res.json({ level: 0 }); }
});

setInterval(() => {
  require('https').get(process.env.RENDER_EXTERNAL_URL + '/', () => {});
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`✅ SUPPORT:${PORT}`));
