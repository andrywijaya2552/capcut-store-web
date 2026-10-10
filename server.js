const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.SERVER_PORT || process.env.PORT || process.env.WEB_PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');
const FLOWIX_BASE = 'https://flowix.web.id/api/v1';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const INITIAL_PACKAGES = [
  {
    id: 'cc-pro-1d',
    name: 'CapCut Pro 1 Hari',
    price: 2000,
    description: 'Akun CapCut Pro aktif 1 hari, bebas watermark. Cocok untuk kebutuhan ekspor jangka pendek.',
    stock: 20,
    isPopular: false
  },
  {
    id: 'cc-pro-7d',
    name: 'CapCut Pro 7 Hari',
    price: 8000,
    description: 'Akun CapCut Pro aktif 7 hari, bebas watermark + garansi replace.',
    stock: 15,
    isPopular: true
  },
  {
    id: 'cc-pro-30d',
    name: 'CapCut Pro 30 Hari',
    price: 25000,
    description: 'Akun CapCut Pro aktif 30 hari, ekspor 4K 60FPS + garansi replace.',
    stock: 10,
    isPopular: true
  },
  {
    id: 'cc-pro-90d',
    name: 'CapCut Pro 90 Hari',
    price: 65000,
    description: 'Akun CapCut Pro aktif 90 hari, ekspor 4K 60FPS + priority support.',
    stock: 8,
    isPopular: false
  },
  {
    id: 'cc-pro-365d',
    name: 'CapCut Pro 1 Tahun',
    price: 199000,
    description: 'Akun CapCut Pro aktif 1 tahun penuh, ekspor 4K 60FPS + garansi replace.',
    stock: 5,
    isPopular: true
  }
];

const INITIAL_PAYMENTS = [
  {
    id: 'qris',
    name: 'QRIS All Payment (Gopay / DANA / OVO / Shopee / BCA)',
    accountNumber: 'SCAN QR OTOMATIS',
    accountName: 'CAPCUT STORE DIGITAL',
    qrImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=00020101021126570011ID.DANA.WWW01189360091800000000005204581253033605802ID5916CAPCUTSTORE6007JAKARTA6304D12A',
    instruction: 'Scan QRIS di atas melalui M-Banking atau E-Wallet apapun. Pastikan nominal transfer sesuai dengan total tiket deposit.'
  },
  {
    id: 'dana',
    name: 'DANA E-Wallet',
    accountNumber: '085812345678',
    accountName: 'Admin CapCut Store',
    qrImage: null,
    instruction: 'Transfer ke nomor DANA di atas. Simpan bukti transfer untuk upload konfirmasi.'
  },
  {
    id: 'gopay',
    name: 'GoPay E-Wallet',
    accountNumber: '085812345678',
    accountName: 'Admin CapCut Store',
    qrImage: null,
    instruction: 'Kirim saldo GoPay ke nomor di atas. Cantumkan username kamu jika memungkinkan.'
  },
  {
    id: 'bca',
    name: 'Bank BCA',
    accountNumber: '8735019281',
    accountName: 'PT CAPCUT DIGITAL INDO',
    qrImage: null,
    instruction: 'Transfer ke rekening BCA di atas lalu upload bukti struk transaksi.'
  }
];

function getDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      settings: {
        siteName: 'CAPCUT STORE ID',
        siteTagline: 'Jasa Beli & Aktivasi Akun CapCut Pro Terpercaya, Diproses Manual oleh Admin',
        contactWa: '6285812345678',
        announcementText: 'SELAMAT DATANG DI CAPCUT STORE ID! Jasa aktivasi akun CapCut Pro, dikirim manual oleh admin, garansi & aman. Proses cepat setiap hari.',
        minTopup: 75,
        deliveryNote: 'Pesanan Anda akan diproses admin maksimal 1x24 jam. Kredensial akun asli akan dikirim melalui halaman "Akun Saya". Pastikan WhatsApp Anda aktif untuk konfirmasi.',
        flowixApiKey: process.env.FLOWIX_API_KEY || '',
        flowixMerchantId: process.env.FLOWIX_MERCHANT_ID || '',
        flowixWebhookSecret: process.env.FLOWIX_WEBHOOK_SECRET || '',
        flowixAutoActive: true
      },
      users: [
        {
          id: 'usr_admin',
          username: process.env.ADMIN_USERNAME || 'admin',
          password: process.env.ADMIN_PASSWORD || 'admin123',
          fullName: 'Super Administrator',
          email: 'admin@capcutstore.com',
          role: 'admin',
          balance: 10000000,
          createdAt: new Date().toISOString()
        },
        {
          id: 'usr_demo',
          username: 'demo_user',
          password: 'password123',
          fullName: 'Demo Member',
          email: 'demo@capcutstore.com',
          role: 'member',
          balance: 50000,
          createdAt: new Date().toISOString()
        }
      ],
      packages: INITIAL_PACKAGES,
      payments: INITIAL_PAYMENTS,
      orders: [],
      topups: [],
      vouchers: [
        {
          code: 'CAPCUTNEW',
          type: 'percent',
          discount: 20,
          maxDiscount: 10000,
          minOrder: 2000,
          usageLimit: 200,
          usedCount: 0,
          isActive: true
        },
        {
          code: 'HEMAT5K',
          type: 'fixed',
          discount: 5000,
          maxDiscount: 5000,
          minOrder: 10000,
          usageLimit: 50,
          usedCount: 0,
          isActive: true
        }
      ],
      chats: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    if (!Array.isArray(data.users)) data.users = [];
    if (!Array.isArray(data.packages)) data.packages = [];
    if (!Array.isArray(data.payments)) data.payments = INITIAL_PAYMENTS;
    if (!Array.isArray(data.orders)) data.orders = [];
    if (!Array.isArray(data.topups)) data.topups = [];
    if (!Array.isArray(data.vouchers)) data.vouchers = [];
    if (!Array.isArray(data.chats)) data.chats = [];
    // Migrasi pengaturan Flowix Payment Gateway
    if (data.settings) {
      if (data.settings.flowixApiKey === undefined) data.settings.flowixApiKey = process.env.FLOWIX_API_KEY || '';
      if (data.settings.flowixMerchantId === undefined) data.settings.flowixMerchantId = process.env.FLOWIX_MERCHANT_ID || '';
      if (data.settings.flowixWebhookSecret === undefined) data.settings.flowixWebhookSecret = process.env.FLOWIX_WEBHOOK_SECRET || '';
      if (data.settings.flowixAutoActive === undefined) data.settings.flowixAutoActive = true;
    }
    // Migrasi produk: pastikan stok & harga valid, hapus field paket lama (duration/features)
    (data.packages || []).forEach(p => {
      if (p.stock === undefined || p.stock === null || isNaN(Number(p.stock))) p.stock = 10;
      else p.stock = Number(p.stock);
      p.price = Number(p.price) || 0;
      delete p.duration;
      delete p.features;
    });
    // Migrasi pesanan lama (model auto-generate) ke model jasa pengiriman manual
    (data.orders || []).forEach(o => {
      if (!o.provider) o.provider = 'manual';
      if (o.status === 'Active' && o.accountEmail) {
        o.status = 'Delivered';
        o.deliveredAt = o.deliveredAt || o.createdAt;
      }
      if (o.status === 'Active' && !o.accountEmail) o.status = 'Processing';
    });
    return data;
  } catch (err) {
    return { users: [], packages: [], orders: [], topups: [], vouchers: [], chats: [], payments: [], settings: {} };
  }
}

function saveDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/public/info', (req, res) => {
  const db = getDB();
  const safeSettings = { ...db.settings };
  const hasFlowix = !!(db.settings?.flowixApiKey || process.env.FLOWIX_API_KEY) && db.settings?.flowixAutoActive !== false;
  safeSettings.hasFlowix = hasFlowix;
  delete safeSettings.flowixApiKey;
  delete safeSettings.flowixMerchantId;
  delete safeSettings.flowixWebhookSecret;
  res.json({
    success: true,
    settings: safeSettings,
    packages: db.packages || INITIAL_PACKAGES,
    payments: db.payments || INITIAL_PAYMENTS
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, fullName, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username dan Password wajib diisi!' });
  }
  if (username.trim().length < 3) {
    return res.status(400).json({ success: false, message: 'Username minimal 3 karakter!' });
  }
  if (password.trim().length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter!' });
  }

  const db = getDB();
  const exists = db.users.find(u => u.username.toLowerCase() === username.trim().toLowerCase());
  if (exists) {
    return res.status(400).json({ success: false, message: 'Username sudah digunakan, silakan pilih yang lain!' });
  }

  const newUser = {
    id: 'usr_' + Date.now(),
    username: username.trim(),
    password: password.trim(),
    fullName: fullName ? fullName.trim() : username.trim(),
    email: email ? email.trim() : `${username.trim()}@capcutuser.com`,
    role: 'member',
    balance: 0,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDB(db);

  const { password: _, ...safeUser } = newUser;
  return res.json({ success: true, message: 'Akun berhasil didaftarkan! Silakan login.', user: safeUser });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const db = getDB();
  const user = db.users.find(u => u.username.toLowerCase() === (username || '').trim().toLowerCase() && u.password === (password || '').trim());

  if (!user) {
    return res.status(401).json({ success: false, message: 'Username atau Password salah!' });
  }

  const { password: _, ...safeUser } = user;
  return res.json({ success: true, message: `Selamat datang, ${user.fullName || user.username}!`, user: safeUser });
});

app.get('/api/user/profile', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const { password: _, ...safeUser } = user;
  return res.json({ success: true, user: safeUser });
});

app.post('/api/voucher/check', (req, res) => {
  const { code, amount } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Masukkan kode voucher!' });

  const db = getDB();
  const v = (db.vouchers || []).find(item => item.code.toUpperCase() === code.trim().toUpperCase() && item.isActive);

  if (!v) {
    return res.status(404).json({ success: false, message: 'Kode voucher tidak valid atau sudah kedaluwarsa!' });
  }
  if (v.usageLimit && v.usedCount >= v.usageLimit) {
    return res.status(400).json({ success: false, message: 'Kuota pemakaian voucher ini sudah habis!' });
  }

  const rawAmount = Number(amount) || 0;
  if (rawAmount < v.minOrder) {
    return res.status(400).json({ success: false, message: `Minimal pembelian untuk voucher ini adalah Rp ${v.minOrder.toLocaleString()}` });
  }

  let discount = 0;
  if (v.type === 'percent') {
    discount = Math.round((rawAmount * v.discount) / 100);
    if (v.maxDiscount && discount > v.maxDiscount) discount = v.maxDiscount;
  } else {
    discount = v.discount;
  }
  if (discount > rawAmount) discount = rawAmount;

  return res.json({
    success: true,
    message: `Voucher ${v.code} aktif! Hemat Rp ${discount.toLocaleString()}`,
    voucher: { code: v.code, discountAmount: discount, finalAmount: rawAmount - discount }
  });
});

app.post('/api/orders/create', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { packageId, voucherCode } = req.body;

  if (!userId) return res.status(401).json({ success: false, message: 'Silakan login terlebih dahulu!' });
  if (!packageId) return res.status(400).json({ success: false, message: 'Pilih paket CapCut terlebih dahulu!' });

  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  const pkg = (db.packages || []).find(p => p.id === packageId);
  if (!pkg) return res.status(404).json({ success: false, message: 'Paket tidak ditemukan!' });

  if (Number(pkg.stock) <= 0) {
    return res.status(400).json({ success: false, message: 'Stok paket ini sedang habis! Silakan pilih paket lain atau hubungi admin.' });
  }

  const rawPrice = pkg.price;
  let finalPrice = rawPrice;
  let discountUsed = 0;
  let appliedVoucher = null;

  if (voucherCode) {
    const v = (db.vouchers || []).find(item => item.code.toUpperCase() === voucherCode.trim().toUpperCase() && item.isActive);
    if (v && (!v.usageLimit || v.usedCount < v.usageLimit) && rawPrice >= v.minOrder) {
      if (v.type === 'percent') {
        discountUsed = Math.round((rawPrice * v.discount) / 100);
        if (v.maxDiscount && discountUsed > v.maxDiscount) discountUsed = v.maxDiscount;
      } else {
        discountUsed = v.discount;
      }
      if (discountUsed > rawPrice) discountUsed = rawPrice;
      finalPrice = rawPrice - discountUsed;
      v.usedCount = (v.usedCount || 0) + 1;
      appliedVoucher = v.code;
    }
  }

  if (user.balance < finalPrice) {
    return res.status(400).json({
      success: false,
      message: `Saldo tidak mencukupi! Diperlukan Rp ${finalPrice.toLocaleString()}, saldo Anda Rp ${user.balance.toLocaleString()}. Silakan Top Up Saldo terlebih dahulu.`
    });
  }

  user.balance -= finalPrice;
  pkg.stock = Number(pkg.stock) - 1;

  const newOrder = {
    id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
    userId: user.id,
    username: user.username,
    packageId: pkg.id,
    packageName: pkg.name,
    price: finalPrice,
    rawPrice: rawPrice,
    discount: discountUsed,
    voucherCode: appliedVoucher,
    accountEmail: '',
    accountPassword: '',
    accountNote: '',
    provider: 'manual',
    status: 'Processing',
    createdAt: new Date().toISOString(),
    deliveredAt: null
  };

  db.orders.unshift(newOrder);
  saveDB(db);

  return res.json({
    success: true,
    message: 'Pesanan berhasil dibuat! Admin akan memproses dan mengirim kredensial akun CapCut Pro Anda maksimal 1x24 jam.',
    order: newOrder,
    newBalance: user.balance
  });
});

app.get('/api/orders/my-accounts', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const db = getDB();
  const userOrders = (db.orders || []).filter(o => o.userId === userId);
  return res.json({ success: true, orders: userOrders });
});

app.post('/api/topup/request', async (req, res) => {
  const userId = req.headers['x-user-id'];
  const { paymentId, amount, notes, method } = req.body;

  if (!userId) return res.status(401).json({ success: false, message: 'Silakan login!' });

  const depAmount = parseInt(amount, 10);
  const db = getDB();
  const minTopup = Number(db.settings?.minTopup) || 75;
  if (isNaN(depAmount) || depAmount < minTopup) {
    return res.status(400).json({ success: false, message: `Minimal deposit adalah Rp ${minTopup.toLocaleString()}!` });
  }

  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  // 1. FLOWIX AUTO GATEWAY (flowix.web.id) - QRIS & Virtual Account
  if (paymentId === 'flowix' || paymentId === 'flowix-qris' || paymentId === 'flowix-va') {
    const flowixApiKey = db.settings?.flowixApiKey || process.env.FLOWIX_API_KEY || '';
    const flowixMerchantId = db.settings?.flowixMerchantId || process.env.FLOWIX_MERCHANT_ID || '';

    if (!flowixApiKey) {
      return res.status(400).json({
        success: false,
        message: 'Payment Gateway Flowix belum dikonfigurasi oleh Admin. Silakan gunakan transfer manual atau hubungi admin.'
      });
    }

    const payMethod = (method || 'QRIS').toUpperCase();
    const orderId = `DEP-FLX-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`.toUpperCase();

    try {
      const headers = { 'Content-Type': 'application/json', 'api_key': flowixApiKey };
      if (flowixMerchantId) headers['merchant_id'] = flowixMerchantId;

      const flxRes = await fetch(`${FLOWIX_BASE}/deposit`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          amount: depAmount,
          method_code: payMethod,
          fee_by_customer: true,
          api_key: flowixApiKey,
          merchant_id: flowixMerchantId
        })
      });

      const flxData = await flxRes.json().catch(() => null);

      if (!flxRes.ok || !flxData || !flxData.success) {
        console.error('Flowix deposit error:', flxData);
        const flxMsg = flxData?.message || 'Terjadi kesalahan pada gateway.';
        return res.status(502).json({
          success: false,
          message: `Gagal membuat deposit di Flowix: ${flxMsg} Pastikan API Key, Merchant ID, saluran aktif, dan IP server sudah di-whitelist di dashboard Flowix.`,
          detail: flxData
        });
      }

      const deposit = flxData.data || {};
      const totalPayment = deposit.amount_total || deposit.amount_request || depAmount;
      let rawPaymentNumber = deposit.qr_string || deposit.pay_code || '';
      const qrisTagIdx = rawPaymentNumber.indexOf('000201');
      if (qrisTagIdx > 0) rawPaymentNumber = rawPaymentNumber.substring(qrisTagIdx);

      let qrDataUrl = '';
      if (rawPaymentNumber) {
        try {
          qrDataUrl = await QRCode.toDataURL(rawPaymentNumber, {
            errorCorrectionLevel: 'M', margin: 3, width: 450,
            color: { dark: '#000000', light: '#ffffff' }
          });
        } catch (qrErr) {
          console.error('QR code generation error:', qrErr);
        }
      }

      const expiredAt = deposit.expired_at || new Date(Date.now() + 15 * 60000).toISOString();

      const newTopup = {
        id: orderId,
        reffId: deposit.reff_id || orderId,
        userId: user.id,
        username: user.username,
        paymentMethod: `Flowix (${payMethod})`,
        paymentId: 'flowix',
        gateway: 'flowix',
        gatewayMethod: payMethod.toLowerCase(),
        amount: depAmount,
        totalPay: totalPayment,
        fee: deposit.fee || 0,
        paymentNumber: rawPaymentNumber,
        qrDataUrl: qrDataUrl || deposit.qr_image || '',
        payUrl: deposit.pay_url || '',
        expiredAt: expiredAt,
        proofUrl: '',
        notes: notes || 'Otomatis via Flowix.web.id Payment Gateway',
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      db.topups.unshift(newTopup);
      saveDB(db);

      return res.json({
        success: true,
        message: 'Pembayaran Flowix otomatis berhasil dibuat! Silakan bayar sebelum kedaluwarsa.',
        topup: newTopup,
        isAutoGateway: true
      });
    } catch (err) {
      console.error('Flowix fetch error:', err);
      return res.status(500).json({ success: false, message: 'Terjadi gangguan jaringan saat menghubungi gateway Flowix.' });
    }
  }

  const payment = (db.payments || []).find(p => p.id === paymentId);
  if (!payment) return res.status(400).json({ success: false, message: 'Metode pembayaran tidak valid!' });

  const uniqueCode = Math.floor(Math.random() * 300) + 1;
  const totalPay = depAmount + uniqueCode;

  const newTopup = {
    id: 'DEP-' + Math.floor(1000 + Math.random() * 9000),
    userId: user.id,
    username: user.username,
    paymentMethod: payment.name,
    paymentId: payment.id,
    amount: depAmount,
    uniqueCode: uniqueCode,
    totalPay: totalPay,
    proofUrl: '',
    notes: notes || '',
    status: 'Pending',
    createdAt: new Date().toISOString()
  };

  db.topups.unshift(newTopup);
  saveDB(db);

  return res.json({
    success: true,
    message: `Tiket deposit dibuat! Silakan transfer Rp ${totalPay.toLocaleString()} (termasuk kode unik ${uniqueCode}).`,
    topup: newTopup,
    payment: payment
  });
});

app.post('/api/topup/upload-proof', (req, res) => {
  const userId = req.headers['x-user-id'];
  const { topupId, proofUrl } = req.body;

  const db = getDB();
  const item = (db.topups || []).find(t => t.id === topupId && t.userId === userId);
  if (!item) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

  item.proofUrl = proofUrl || '';
  saveDB(db);

  return res.json({ success: true, message: 'Bukti transfer berhasil disimpan!', topup: item });
});

app.get('/api/topup/history', (req, res) => {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

  const db = getDB();
  const userTopups = (db.topups || []).filter(t => t.userId === userId);
  return res.json({ success: true, topups: userTopups });
});

// Cek Status Pembayaran Flowix (Polling / Manual Check)
app.get('/api/topup/check-flowix/:topupId', async (req, res) => {
  const { topupId } = req.params;
  const db = getDB();
  const item = (db.topups || []).find(t => t.id === topupId || t.reffId === topupId);

  if (!item) {
    return res.status(404).json({ success: false, message: 'Data deposit tidak ditemukan.' });
  }

  if (item.status === 'Approved') {
    return res.json({ success: true, status: 'Approved', message: 'Pembayaran sudah lunas dan saldo sudah masuk!' });
  }

  const flowixApiKey = db.settings?.flowixApiKey || process.env.FLOWIX_API_KEY || '';
  const flowixMerchantId = db.settings?.flowixMerchantId || process.env.FLOWIX_MERCHANT_ID || '';
  const reffId = item.reffId || item.id;

  try {
    const headers = { 'api_key': flowixApiKey };
    if (flowixMerchantId) headers['merchant_id'] = flowixMerchantId;

    const response = await fetch(`${FLOWIX_BASE}/deposit/${encodeURIComponent(reffId)}`, { headers });
    const flxData = await response.json().catch(() => null);

    if (flxData && flxData.success && flxData.data) {
      const deposit = flxData.data;
      const status = String(deposit.status || '').toLowerCase();

      if (status === 'success' || status === 'paid') {
        item.status = 'Approved';
        item.approvedAt = new Date().toISOString();
        const user = db.users.find(u => u.id === item.userId);
        if (user) user.balance += item.amount;
        saveDB(db);
        return res.json({
          success: true,
          status: 'Approved',
          message: 'Pembayaran Flowix terverifikasi lunas! Saldo berhasil masuk.',
          newBalance: user ? user.balance : undefined
        });
      } else if (status === 'failed' || status === 'expired' || status === 'canceled') {
        item.status = 'Rejected';
        item.rejectedAt = new Date().toISOString();
        saveDB(db);
        return res.json({ success: false, status: 'Rejected', message: 'Transaksi telah kedaluwarsa atau dibatalkan.' });
      }
    }

    return res.json({ success: true, status: item.status, message: 'Menunggu pembayaran dari Anda...' });
  } catch (err) {
    console.error('Check Flowix error:', err);
    return res.status(500).json({ success: false, message: 'Gagal memeriksa status ke Flowix.' });
  }
});

// Webhook Flowix (callback otomatis dari flowix.web.id)
app.post(['/webhook/flowix', '/webhooks/flowix'], (req, res) => {
  const db = getDB();
  const rawBody = req.body;
  const signature = req.header('X-Flowix-Signature');
  const secret = db.settings?.flowixWebhookSecret || process.env.FLOWIX_WEBHOOK_SECRET || '';

  if (secret && signature) {
    try {
      const incoming = String(signature).replace(/^sha256=/i, '');
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(rawBody)).digest('hex');
      if (incoming !== expected) console.warn('Flowix webhook signature mismatch!');
    } catch (sigErr) {
      console.error('Signature check error:', sigErr);
    }
  }

  const data = rawBody?.data || rawBody;
  const reffId = data?.reff_id || data?.order_id;
  const incomingStatus = String(data?.status || '').toLowerCase();

  if (!reffId) return res.status(400).json({ error: 'Reff ID tidak ditemukan' });

  const localTopup = (db.topups || []).find(t => t.id === reffId || t.reffId === reffId);
  if (!localTopup) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
  if (localTopup.status === 'Approved') return res.status(200).json({ success: true, message: 'Already completed' });

  if (incomingStatus === 'success' || incomingStatus === 'paid') {
    localTopup.status = 'Approved';
    localTopup.approvedAt = new Date().toISOString();
    const user = db.users.find(u => u.id === localTopup.userId);
    if (user) {
      user.balance += localTopup.amount;
      console.log(`[FLOWIX AUTO] Saldo ${user.username} bertambah Rp ${localTopup.amount.toLocaleString()} (Reff: ${reffId})`);
    }
    saveDB(db);
  } else if (incomingStatus === 'expired' || incomingStatus === 'canceled' || incomingStatus === 'failed') {
    localTopup.status = 'Rejected';
    localTopup.rejectedAt = new Date().toISOString();
    saveDB(db);
  }

  return res.status(200).json({ success: true });
});

app.post('/api/chat/send', (req, res) => {
  const { senderId, senderName, message, role } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Pesan kosong' });

  const db = getDB();
  db.chats = db.chats || [];

  const chatMsg = {
    id: 'msg_' + Date.now(),
    senderId: senderId || 'guest_' + Math.random().toString(36).substr(2, 5),
    senderName: senderName || 'Guest',
    role: role || 'member',
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  db.chats.push(chatMsg);
  if (db.chats.length > 300) db.chats = db.chats.slice(-300);
  saveDB(db);

  return res.json({ success: true, chat: chatMsg });
});

app.get('/api/chat/messages', (req, res) => {
  const db = getDB();
  res.json({ success: true, chats: db.chats || [] });
});

function checkAdmin(req, res, next) {
  const userId = req.headers['x-user-id'];
  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Akses khusus Administrator!' });
  }
  next();
}

app.get('/api/admin/all-data', checkAdmin, (req, res) => {
  const db = getDB();
  const totalUsers = db.users.length;
  const totalAccounts = db.orders.length;
  const pendingOrders = (db.orders || []).filter(o => o.status === 'Processing').length;
  const totalDeposit = (db.topups || []).filter(t => t.status === 'Approved').reduce((a, b) => a + b.amount, 0);
  const pendingDeposit = (db.topups || []).filter(t => t.status === 'Pending').length;
  const totalRevenue = (db.orders || []).filter(o => o.status !== 'Cancelled').reduce((a, b) => a + (b.price || 0), 0);

  res.json({
    success: true,
    stats: { totalUsers, totalAccounts, pendingOrders, totalDeposit, pendingDeposit, totalRevenue },
    settings: db.settings,
    users: db.users.map(({ password, ...u }) => u),
    orders: db.orders,
    topups: db.topups,
    packages: db.packages,
    vouchers: db.vouchers,
    payments: db.payments
  });
});

app.post('/api/admin/settings/save', checkAdmin, (req, res) => {
  const {
    siteName, siteTagline, contactWa, announcementText, minTopup, deliveryNote, payments,
    flowixApiKey, flowixMerchantId, flowixWebhookSecret, flowixAutoActive
  } = req.body;
  const db = getDB();

  db.settings = {
    ...db.settings,
    siteName: siteName !== undefined ? siteName : db.settings.siteName,
    siteTagline: siteTagline !== undefined ? siteTagline : db.settings.siteTagline,
    contactWa: contactWa !== undefined ? contactWa : db.settings.contactWa,
    announcementText: announcementText !== undefined ? announcementText : db.settings.announcementText,
    minTopup: minTopup !== undefined ? (Number(minTopup) || 0) : (db.settings.minTopup || 75),
    deliveryNote: deliveryNote !== undefined ? deliveryNote : (db.settings.deliveryNote || ''),
    flowixApiKey: flowixApiKey !== undefined ? String(flowixApiKey).trim() : (db.settings.flowixApiKey || ''),
    flowixMerchantId: flowixMerchantId !== undefined ? String(flowixMerchantId).trim() : (db.settings.flowixMerchantId || ''),
    flowixWebhookSecret: flowixWebhookSecret !== undefined ? String(flowixWebhookSecret).trim() : (db.settings.flowixWebhookSecret || ''),
    flowixAutoActive: flowixAutoActive !== undefined ? !!flowixAutoActive : (db.settings.flowixAutoActive ?? true)
  };

  if (Array.isArray(payments)) {
    db.payments = payments.map(p => ({
      id: p.id,
      name: p.name,
      accountNumber: p.accountNumber || '',
      accountName: p.accountName || '',
      qrImage: p.qrImage || null,
      instruction: p.instruction || ''
    }));
  }

  saveDB(db);
  return res.json({ success: true, message: 'Pengaturan website berhasil disimpan!', settings: db.settings, payments: db.payments });
});

app.post('/api/admin/topup/action', checkAdmin, (req, res) => {
  const { topupId, action } = req.body;
  const db = getDB();
  const item = (db.topups || []).find(t => t.id === topupId);
  if (!item) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

  if (item.status !== 'Pending') {
    return res.status(400).json({ success: false, message: `Tiket sudah berstatus ${item.status}` });
  }

  if (action === 'approve') {
    item.status = 'Approved';
    item.approvedAt = new Date().toISOString();
    const user = db.users.find(u => u.id === item.userId);
    if (user) user.balance += item.amount;
  } else {
    item.status = 'Rejected';
    item.rejectedAt = new Date().toISOString();
  }

  saveDB(db);
  return res.json({ success: true, message: `Status deposit berhasil diubah menjadi ${item.status}!` });
});

app.post('/api/admin/packages/save', checkAdmin, (req, res) => {
  const { id, name, price, description, isPopular, stock } = req.body;
  const db = getDB();
  db.packages = db.packages || [];
  const stockVal = (stock === undefined || stock === null || stock === '') ? 0 : Math.max(0, parseInt(stock, 10) || 0);

  if (id) {
    const idx = db.packages.findIndex(p => p.id === id);
    if (idx !== -1) {
      db.packages[idx] = { ...db.packages[idx], name, price: Number(price) || 0, description, isPopular: !!isPopular, stock: stockVal };
      delete db.packages[idx].duration;
      delete db.packages[idx].features;
    }
  } else {
    const newPkg = {
      id: 'cc-' + Date.now(),
      name,
      price: Number(price) || 0,
      description,
      stock: stockVal,
      isPopular: !!isPopular
    };
    db.packages.push(newPkg);
  }

  saveDB(db);
  return res.json({ success: true, message: 'Produk berhasil disimpan!' });
});

app.post('/api/admin/packages/delete', checkAdmin, (req, res) => {
  const { id } = req.body;
  const db = getDB();
  db.packages = (db.packages || []).filter(p => p.id !== id);
  saveDB(db);
  return res.json({ success: true, message: 'Produk berhasil dihapus!' });
});

app.post('/api/admin/users/set-balance', checkAdmin, (req, res) => {
  const { targetUserId, newBalance } = req.body;
  const db = getDB();
  const user = db.users.find(u => u.id === targetUserId);
  if (!user) return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });

  user.balance = parseInt(newBalance, 10) || 0;
  saveDB(db);
  return res.json({ success: true, message: `Saldo ${user.username} diubah menjadi Rp ${user.balance.toLocaleString()}` });
});

app.post('/api/admin/vouchers/save', checkAdmin, (req, res) => {
  const { code, type, discount, maxDiscount, minOrder, usageLimit, isActive } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Kode voucher wajib diisi!' });
  const db = getDB();
  db.vouchers = db.vouchers || [];
  const upper = code.trim().toUpperCase();

  const idx = db.vouchers.findIndex(v => v.code.toUpperCase() === upper);
  const data = {
    code: upper,
    type: type || 'percent',
    discount: Number(discount),
    maxDiscount: Number(maxDiscount) || 0,
    minOrder: Number(minOrder) || 0,
    usageLimit: Number(usageLimit) || 0,
    usedCount: idx !== -1 ? db.vouchers[idx].usedCount : 0,
    isActive: isActive !== undefined ? isActive : true
  };

  if (idx !== -1) db.vouchers[idx] = data;
  else db.vouchers.push(data);

  saveDB(db);
  return res.json({ success: true, message: 'Voucher promo berhasil disimpan!' });
});

app.post('/api/admin/vouchers/delete', checkAdmin, (req, res) => {
  const { code } = req.body;
  const db = getDB();
  db.vouchers = (db.vouchers || []).filter(v => v.code.toUpperCase() !== (code || '').toUpperCase());
  saveDB(db);
  return res.json({ success: true, message: 'Voucher berhasil dihapus!' });
});

app.post('/api/admin/orders/status', checkAdmin, (req, res) => {
  const { orderId, status } = req.body;
  const db = getDB();
  const order = (db.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });

  order.status = status;
  saveDB(db);
  return res.json({ success: true, message: `Status pesanan diubah menjadi ${status}!` });
});

// Admin Kirim / Aktivasi Kredensial Akun CapCut (Pengiriman Manual)
app.post('/api/admin/orders/deliver', checkAdmin, (req, res) => {
  const { orderId, accountEmail, accountPassword, accountNote } = req.body;
  const db = getDB();
  const order = (db.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });

  if (!accountEmail || !accountPassword) {
    return res.status(400).json({ success: false, message: 'Email dan password akun wajib diisi sebelum dikirim!' });
  }

  order.accountEmail = String(accountEmail).trim();
  order.accountPassword = String(accountPassword).trim();
  order.accountNote = (accountNote || '').trim();
  order.status = 'Delivered';
  order.deliveredAt = new Date().toISOString();

  saveDB(db);
  return res.json({ success: true, message: `Kredensial akun untuk pesanan ${order.id} berhasil dikirim ke pembeli!`, order });
});

// Admin Batalkan / Refund Pesanan (Saldo dikembalikan)
app.post('/api/admin/orders/cancel', checkAdmin, (req, res) => {
  const { orderId } = req.body;
  const db = getDB();
  const order = (db.orders || []).find(o => o.id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Pesanan tidak ditemukan.' });
  if (order.status === 'Cancelled') {
    return res.status(400).json({ success: false, message: 'Pesanan sudah dibatalkan.' });
  }

  const user = db.users.find(u => u.id === order.userId);
  if (user) user.balance += order.price;

  const pkg = (db.packages || []).find(p => p.id === order.packageId);
  if (pkg) pkg.stock = Number(pkg.stock || 0) + 1;

  order.status = 'Cancelled';
  order.cancelledAt = new Date().toISOString();
  saveDB(db);
  return res.json({ success: true, message: `Pesanan ${order.id} dibatalkan & saldo Rp ${order.price.toLocaleString()} dikembalikan ke pembeli.` });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log('=========================================');
  console.log(`CAPCUT STORE BERJALAN DI PORT : ${PORT}`);
  console.log(`Buka di Browser: http://IP-SERVER:${PORT}`);
  console.log('=========================================');
});
