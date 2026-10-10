let currentUser = null;
let currentPackages = [];
let currentPayments = [];
let siteSettings = {};
let selectedPackageForBuy = null;
let appliedBuyVoucherData = null;
let isChatOpen = false;
let lastChatCount = 0;
let currentAdminPayments = [];
let currentGatewayOrder = null;
let gatewayPollTimer = null;

function initApp() {
  initUserSession();
  loadPublicInfo();
  setupEventListeners();
  document.getElementById('footerYear').innerText = new Date().getFullYear();
}

function setupEventListeners() {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userDropdown = document.getElementById('userDropdown');
  if (userMenuBtn) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });
    document.addEventListener('click', () => userDropdown.classList.add('hidden'));
  }
  setInterval(fetchChatMessages, 5000);
}

function initUserSession() {
  const stored = localStorage.getItem('capcut_user');
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      updateAuthUI();
    } catch (e) {
      localStorage.removeItem('capcut_user');
    }
  } else {
    updateAuthUI();
  }
}

function updateAuthUI() {
  const navUser = document.getElementById('nav-user-section');
  const navGuest = document.getElementById('nav-guest-section');
  const tabAdmin = document.getElementById('tabBtn-admin');
  const adminDropdownLink = document.getElementById('adminDropdownLink');

  if (currentUser) {
    navGuest.classList.add('hidden');
    navUser.classList.remove('hidden');
    navUser.classList.add('flex');

    document.getElementById('userNameText').innerText = currentUser.username;
    document.getElementById('userAvatarText').innerText = (currentUser.username || 'U')[0].toUpperCase();
    document.getElementById('user-balance-text').innerText = formatRupiah(currentUser.balance || 0);

    if (currentUser.role === 'admin') {
      document.getElementById('userRoleBadge').classList.remove('hidden');
      tabAdmin.classList.remove('hidden');
      adminDropdownLink.classList.remove('hidden');
    } else {
      document.getElementById('userRoleBadge').classList.add('hidden');
      tabAdmin.classList.add('hidden');
      adminDropdownLink.classList.add('hidden');
    }
  } else {
    navUser.classList.add('hidden');
    navUser.classList.remove('flex');
    navGuest.classList.remove('hidden');
    tabAdmin.classList.add('hidden');
    adminDropdownLink.classList.add('hidden');
  }
}

async function refreshUserProfile() {
  if (!currentUser) return;
  try {
    const res = await fetch('/api/user/profile', { headers: { 'x-user-id': currentUser.id } });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem('capcut_user', JSON.stringify(currentUser));
      updateAuthUI();
    }
  } catch (err) {
    console.error('Error sync profile:', err);
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-link').forEach(el => {
    el.classList.remove('bg-pink-500', 'text-white', 'font-bold');
    el.classList.add('text-gray-400');
  });

  const target = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tabBtn-${tabId}`);
  if (target) target.classList.remove('hidden');
  if (targetBtn && tabId !== 'admin') {
    targetBtn.classList.add('bg-pink-500', 'text-white', 'font-bold');
    targetBtn.classList.remove('text-gray-400');
  }

  if (tabId === 'my-accounts') loadUserAccounts();
  if (tabId === 'topup') loadUserTopups();
  if (tabId === 'admin') loadAdminData();
}

async function loadPublicInfo() {
  try {
    const res = await fetch('/api/public/info');
    const data = await res.json();
    if (data.success) {
      currentPackages = data.packages || [];
      currentPayments = data.payments || [];
      siteSettings = data.settings || {};

      if (siteSettings.siteName) {
        const parts = siteSettings.siteName.split(' ');
        document.getElementById('brandSiteName').innerHTML = `${parts[0]}<span class="text-pink-400">${parts.slice(1).join(' ') || 'Store'}</span>`;
        document.getElementById('footerSiteName').innerText = siteSettings.siteName;
        document.title = siteSettings.siteName + ' - Akun CapCut Pro Otomatis';
      }
      if (siteSettings.siteTagline) document.getElementById('brandTagline').innerText = siteSettings.siteTagline;
      if (siteSettings.announcementText) document.getElementById('broadcastMarquee').innerText = siteSettings.announcementText;
      if (siteSettings.contactWa) {
        const waLink = document.getElementById('footerWaLink');
        if (waLink) waLink.href = `https://wa.me/${siteSettings.contactWa}?text=Halo%20Admin%20CapCut%20Store`;
      }
      const minTopup = Number(siteSettings.minTopup) || 75;
      document.getElementById('minTopupLabel').innerText = formatRupiah(minTopup);
      const amt = document.getElementById('topupAmount');
      if (amt) amt.min = minTopup;
      if (siteSettings.deliveryNote) {
        const dn = document.getElementById('buyDeliveryNote');
        if (dn) dn.innerText = siteSettings.deliveryNote;
      }

      renderPackagesList();
      populatePaymentSelect();
    }
  } catch (err) {
    console.error('Error load public info:', err);
  }
}

function renderPackagesList() {
  const container = document.getElementById('packagesGridContainer');
  if (!container) return;

  if (!currentPackages.length) {
    container.innerHTML = `<p class="text-gray-500 text-sm">Belum ada produk tersedia.</p>`;
    return;
  }

  const header = `
    <div class="hidden sm:grid grid-cols-12 gap-4 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
      <div class="col-span-6">Produk</div>
      <div class="col-span-2 text-center">Stok</div>
      <div class="col-span-2 text-right">Harga</div>
      <div class="col-span-2 text-right">Aksi</div>
    </div>`;

  container.innerHTML = header + currentPackages.map(p => {
    const soldOut = Number.isFinite(Number(p.stock)) && Number(p.stock) <= 0;
    const stockBadge = Number.isFinite(Number(p.stock))
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${soldOut ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'}">${soldOut ? 'Habis' : Number(p.stock)}</span>`
      : '<span class="text-[11px] text-gray-500">∞</span>';
    return `
    <div class="glass-card rounded-2xl border ${p.isPopular ? 'border-pink-500/50 bg-pink-950/10' : 'border-gray-800'} px-5 py-4 transition hover:border-pink-500/40">
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
        <div class="sm:col-span-6 flex items-start gap-3 min-w-0">
          <div class="w-10 h-10 shrink-0 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center text-lg"><i class="ri-scissors-cut-line"></i></div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-sm font-bold text-white">${p.name}</h3>
              ${p.isPopular ? `<span class="bg-gradient-to-r from-pink-500 to-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">Paling Laris</span>` : ''}
            </div>
            <p class="text-[11px] text-gray-400 leading-relaxed mt-0.5">${p.description || ''}</p>
          </div>
        </div>
        <div class="sm:col-span-2 sm:text-center">
          <span class="sm:hidden text-[11px] text-gray-500 mr-1">Stok:</span>${stockBadge}
        </div>
        <div class="sm:col-span-2 sm:text-right">
          <p class="text-lg font-black text-pink-400 font-mono">${formatRupiah(p.price)}</p>
        </div>
        <div class="sm:col-span-2 sm:text-right">
          <button ${soldOut ? 'disabled' : `onclick="openBuyModal('${p.id}')"`} class="w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-xs transition inline-flex items-center justify-center gap-1.5 ${soldOut ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white'}">
            <i class="${soldOut ? 'ri-close-circle-line' : 'ri-shopping-bag-3-fill'}"></i> ${soldOut ? 'Stok Habis' : 'Beli'}
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function openBuyModal(pkgId) {
  const pkg = currentPackages.find(p => p.id === pkgId);
  if (!pkg) return;
  if (Number.isFinite(Number(pkg.stock)) && Number(pkg.stock) <= 0) {
    showToast('Stok produk ini sedang habis!', 'warning');
    return;
  }
  selectedPackageForBuy = pkg;
  appliedBuyVoucherData = null;
  const stockText = Number.isFinite(Number(pkg.stock)) ? `Stok tersedia: ${Number(pkg.stock)}` : '';
  document.getElementById('modalBuyPkgName').innerText = pkg.name;
  document.getElementById('modalBuyPkgSpecs').innerText = stockText;
  document.getElementById('buyPackageId').value = pkg.id;
  document.getElementById('buyRawPrice').innerText = formatRupiah(pkg.price);
  document.getElementById('buyFinalPrice').innerText = formatRupiah(pkg.price);
  document.getElementById('buyDiscountRow').classList.add('hidden');
  document.getElementById('buyVoucherInput').value = '';
  document.getElementById('buyVoucherMsg').classList.add('hidden');
  document.getElementById('buyUserBalance').innerText = currentUser ? formatRupiah(currentUser.balance || 0) : 'Login dulu';
  openModal('modalCheckout');
}

async function applyBuyVoucher() {
  const code = (document.getElementById('buyVoucherInput')?.value || '').trim();
  const msgElem = document.getElementById('buyVoucherMsg');
  if (!code) { showToast('Masukkan kode voucher!', 'warning'); return; }
  if (!selectedPackageForBuy) return;

  try {
    const res = await fetch('/api/voucher/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, amount: selectedPackageForBuy.price })
    });
    const data = await res.json();
    msgElem.classList.remove('hidden');

    if (data.success && data.voucher) {
      appliedBuyVoucherData = data.voucher;
      msgElem.className = 'text-[11px] mt-1 text-emerald-400';
      msgElem.innerHTML = `<i class="ri-checkbox-circle-line"></i> ${data.message}`;
      document.getElementById('buyDiscountRow').classList.remove('hidden');
      document.getElementById('buyDiscountRow').classList.add('flex');
      document.getElementById('buyDiscountVal').innerText = `- ${formatRupiah(data.voucher.discountAmount)}`;
      document.getElementById('buyFinalPrice').innerText = formatRupiah(data.voucher.finalAmount);
    } else {
      appliedBuyVoucherData = null;
      msgElem.className = 'text-[11px] mt-1 text-red-400';
      msgElem.innerHTML = `<i class="ri-error-warning-line"></i> ${data.message}`;
      document.getElementById('buyDiscountRow').classList.add('hidden');
      document.getElementById('buyFinalPrice').innerText = formatRupiah(selectedPackageForBuy.price);
    }
  } catch (err) {
    showToast('Gagal cek voucher promo.', 'error');
  }
}

async function handleConfirmBuy(e) {
  e.preventDefault();
  if (!currentUser) {
    closeModal('modalCheckout');
    showToast('Silakan login terlebih dahulu!', 'warning');
    openModal('modalLogin');
    return;
  }
  if (!selectedPackageForBuy) return;

  const btn = document.getElementById('btnConfirmBuy');
  btn.disabled = true;
  btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Membuat pesanan...`;

  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({
        packageId: selectedPackageForBuy.id,
        voucherCode: appliedBuyVoucherData ? appliedBuyVoucherData.code : ''
      })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('modalCheckout');
      showOrderResult(data.order);
      await refreshUserProfile();
      showToast(data.message, 'success');
    } else {
      showToast(data.message || 'Gagal membuat pesanan.', 'error');
      if ((data.message || '').toLowerCase().includes('saldo')) {
        setTimeout(() => { closeModal('modalCheckout'); switchTab('topup'); }, 1200);
      }
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat memproses pesanan.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ri-shopping-bag-3-fill"></i> Bayar & Buat Pesanan`;
  }
}

function showOrderResult(order) {
  document.getElementById('resultPkgName').innerText = order.packageName;
  document.getElementById('resultOrderId').innerText = order.id;
  const statusEl = document.getElementById('resultStatus');
  statusEl.innerText = statusLabel(order.status);
  statusEl.className = `px-2 py-0.5 rounded-full font-bold text-[10px] ${statusColor(order.status)}`;
  openModal('modalAccountResult');
}

function statusLabel(status) {
  return { Processing: 'Menunggu Diproses', Delivered: 'Selesai / Dikirim', Cancelled: 'Dibatalkan', Active: 'Aktif', Suspended: 'Ditangguhkan' }[status] || status;
}

function statusColor(status) {
  return {
    Processing: 'bg-amber-500/20 text-amber-400',
    Delivered: 'bg-emerald-500/20 text-emerald-400',
    Active: 'bg-emerald-500/20 text-emerald-400',
    Cancelled: 'bg-red-500/20 text-red-400',
    Suspended: 'bg-red-500/20 text-red-400'
  }[status] || 'bg-gray-600/30 text-gray-300';
}

async function loadUserAccounts() {
  const container = document.getElementById('userAccountsContainer');
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = `<p class="text-center text-gray-500 text-xs py-10 col-span-2">Silakan login untuk melihat akun Anda.</p>`;
    return;
  }

  try {
    const res = await fetch('/api/orders/my-accounts', { headers: { 'x-user-id': currentUser.id } });
    const data = await res.json();
    if (!data.success || !data.orders || data.orders.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-500 text-xs py-10 col-span-2">Belum ada akun. Silakan beli produk terlebih dahulu.</p>`;
      return;
    }

    container.innerHTML = data.orders.map(o => {
      const delivered = o.status === 'Delivered' && o.accountEmail;
      let body = '';
      if (delivered) {
        body = `
          <div class="space-y-1.5">
            <div class="flex justify-between items-center bg-gray-950 p-2.5 rounded-lg border border-gray-800">
              <div><p class="text-[10px] text-gray-500">Email / Username</p><span id="acc-email-${o.id}" class="font-mono text-xs text-white break-all">${o.accountEmail}</span></div>
              <button onclick="copyText('acc-email-${o.id}')" class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px] text-gray-300 shrink-0"><i class="ri-file-copy-line"></i></button>
            </div>
            <div class="flex justify-between items-center bg-gray-950 p-2.5 rounded-lg border border-gray-800">
              <div><p class="text-[10px] text-gray-500">Password</p><span id="acc-pass-${o.id}" class="font-mono text-xs text-white break-all">${o.accountPassword}</span></div>
              <button onclick="copyText('acc-pass-${o.id}')" class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px] text-gray-300 shrink-0"><i class="ri-file-copy-line"></i></button>
            </div>
            ${o.accountNote ? `<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex gap-2"><i class="ri-alert-line shrink-0"></i><span>${o.accountNote}</span></div>` : ''}
          </div>`;
      } else if (o.status === 'Cancelled') {
        body = `<div class="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-[11px] flex gap-2"><i class="ri-close-circle-line shrink-0"></i><span>Pesanan dibatalkan. Saldo telah dikembalikan ke akun Anda.</span></div>`;
      } else {
        body = `<div class="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex gap-2"><i class="ri-time-line shrink-0"></i><span>Sedang diproses admin (maks 1x24 jam). Kredensial akun akan muncul di sini setelah dikirim.</span></div>`;
      }

      return `
      <div class="p-4 rounded-2xl bg-gray-900 border border-gray-800 space-y-3">
        <div class="flex justify-between items-center">
          <span class="font-mono font-bold text-pink-300 text-xs">${o.id}</span>
          <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${statusColor(o.status)}">${statusLabel(o.status)}</span>
        </div>
        <div>
          <p class="text-sm font-bold text-white">${o.packageName}</p>
          <p class="text-[11px] text-gray-400">Dibuat: ${new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        ${body}
      </div>`;
    }).join('');
  } catch (err) {
    console.error('Error load accounts:', err);
  }
}

function populatePaymentSelect() {
  const sel = document.getElementById('topupPaymentSelect');
  if (!sel) return;
  const options = [];
  if (siteSettings.hasFlowix) {
    options.push(`<option value="flowix" class="text-emerald-400 font-bold">Flowix Gateway Otomatis (QRIS & Virtual Account)</option>`);
  }
  currentPayments.forEach(p => {
    options.push(`<option value="${p.id}">${p.name}</option>`);
  });
  if (!options.length) { sel.innerHTML = `<option value="">Tidak ada metode</option>`; return; }
  sel.innerHTML = options.join('');
  handlePaymentChange();
}

function handlePaymentChange() {
  const sel = document.getElementById('topupPaymentSelect');
  if (!sel) return;
  const flowixSub = document.getElementById('flowixSubOptions');
  const payInfoBox = document.getElementById('paymentInstructionBox');

  if (flowixSub) flowixSub.classList.add('hidden');

  if (sel.value === 'flowix') {
    if (flowixSub) flowixSub.classList.remove('hidden');
    if (payInfoBox) payInfoBox.classList.add('hidden');
    return;
  }

  if (payInfoBox) payInfoBox.classList.remove('hidden');

  const pay = currentPayments.find(p => p.id === sel.value);
  if (!pay) return;
  document.getElementById('payAccName').innerText = `Atas Nama: ${pay.accountName || '-'}`;
  document.getElementById('payAccNumber').innerText = `Nomor: ${pay.accountNumber || '-'}`;
  document.getElementById('payInstructionText').innerText = pay.instruction || '';

  const qrContainer = document.getElementById('payQrContainer');
  const qrImg = document.getElementById('payQrImg');
  if (pay.qrImage) {
    qrContainer.classList.remove('hidden');
    qrImg.src = pay.qrImage;
  } else {
    qrContainer.classList.add('hidden');
  }
}

async function handleRequestTopup(e) {
  e.preventDefault();
  if (!currentUser) {
    showToast('Silakan login terlebih dahulu!', 'warning');
    openModal('modalLogin');
    return;
  }

  const paymentId = document.getElementById('topupPaymentSelect').value;
  const amount = document.getElementById('topupAmount').value;
  const notes = document.getElementById('topupNotes').value.trim();

  let method = 'QRIS';
  if (paymentId === 'flowix') {
    const checked = document.querySelector('input[name="flowixChannel"]:checked');
    if (checked) method = checked.value;
  }

  const btn = document.querySelector('#topupForm button[type="submit"]');
  const originalBtn = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Memproses...`; }

  try {
    const res = await fetch('/api/topup/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ paymentId, amount, notes, method })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('topupAmount').value = '';
      document.getElementById('topupNotes').value = '';
      loadUserTopups();
      if (data.isAutoGateway && data.topup) {
        openGatewayPaymentModal(data.topup);
      }
    } else {
      showToast(data.message || 'Gagal membuat tiket deposit.', 'error');
    }
  } catch (err) {
    showToast('Terjadi kesalahan saat membuat tiket deposit.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = originalBtn; }
  }
}

function openGatewayPaymentModal(topup) {
  currentGatewayOrder = topup;
  document.getElementById('gwOrderId').innerText = topup.id;
  document.getElementById('gwTotalPay').innerText = formatRupiah(topup.totalPay);
  document.getElementById('gwMethodBadge').innerText = (topup.gatewayMethod || 'qris').toUpperCase();
  const link = document.getElementById('gwDirectPayLink');
  if (topup.payUrl) { link.href = topup.payUrl; link.classList.remove('hidden'); }
  else link.classList.add('hidden');
  document.getElementById('gwLiveStatus').innerText = 'Menunggu Pembayaran...';
  document.getElementById('gwLiveStatus').className = 'font-bold text-amber-400';

  const qrBox = document.getElementById('gwQrBox');
  const vaBox = document.getElementById('gwVaBox');
  const gm = (topup.gatewayMethod || '').toLowerCase();
  const isVa = gm.includes('va') || gm === 'bca' || gm === 'bni' || gm === 'bri' || gm === 'mandiri' || gm === 'permata';

  if (isVa) {
    qrBox.classList.add('hidden');
    vaBox.classList.remove('hidden');
    document.getElementById('gwVaNumber').innerText = topup.paymentNumber || '-';
    document.getElementById('gwModalSubtitle').innerText = `Transfer ke nomor Virtual Account ${gm.toUpperCase()} di bawah`;
  } else {
    qrBox.classList.remove('hidden');
    vaBox.classList.add('hidden');
    document.getElementById('gwModalSubtitle').innerText = 'Scan kode QRIS di bawah melalui E-Wallet atau Mobile Banking';
    const img = document.getElementById('gwQrImage');
    if (topup.qrDataUrl) {
      img.src = topup.qrDataUrl;
    } else if (topup.paymentNumber) {
      let s = topup.paymentNumber;
      const idx = s.indexOf('000201');
      if (idx > 0) s = s.substring(idx);
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&margin=10&data=${encodeURIComponent(s)}`;
    }
  }

  openModal('modalGatewayPay');

  if (gatewayPollTimer) clearInterval(gatewayPollTimer);
  gatewayPollTimer = setInterval(async () => {
    if (!currentGatewayOrder || currentGatewayOrder.id !== topup.id) { clearInterval(gatewayPollTimer); return; }
    const done = await checkFlowixStatus(topup.id, false);
    if (done) clearInterval(gatewayPollTimer);
  }, 4000);
}

async function checkFlowixStatus(topupId, isManualAlert = false) {
  try {
    const res = await fetch(`/api/topup/check-flowix/${topupId}`);
    const data = await res.json();

    if (data.status === 'Approved') {
      document.getElementById('gwLiveStatus').innerText = 'Pembayaran Lunas!';
      document.getElementById('gwLiveStatus').className = 'font-bold text-emerald-400';
      showToast('Pembayaran berhasil! Saldo telah ditambahkan ke akun Anda.', 'success');
      refreshUserProfile();
      loadUserTopups();
      setTimeout(() => closeModal('modalGatewayPay'), 2500);
      return true;
    } else if (data.status === 'Rejected') {
      document.getElementById('gwLiveStatus').innerText = 'Transaksi Dibatalkan / Expired';
      document.getElementById('gwLiveStatus').className = 'font-bold text-red-400';
      if (isManualAlert) showToast('Transaksi ini sudah kedaluwarsa atau dibatalkan.', 'error');
      return true;
    } else {
      if (isManualAlert) showToast('Menunggu pembayaran dari Anda...', 'info');
      return false;
    }
  } catch (err) {
    if (isManualAlert) showToast('Gagal memeriksa status pembayaran.', 'error');
    return false;
  }
}

async function checkFlowixStatusManual() {
  if (!currentGatewayOrder) return;
  const btn = document.getElementById('gwCheckBtn');
  const original = btn.innerHTML;
  btn.innerHTML = `<i class="ri-loader-4-line animate-spin"></i> Memeriksa...`;
  await checkFlowixStatus(currentGatewayOrder.id, true);
  btn.innerHTML = original;
}

async function loadUserTopups() {
  if (!currentUser) return;
  const container = document.getElementById('topupListContainer');
  try {
    const res = await fetch('/api/topup/history', { headers: { 'x-user-id': currentUser.id } });
    const data = await res.json();
    if (data.success) {
      if (!data.topups || data.topups.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 text-xs py-10">Belum ada riwayat tiket deposit.</p>`;
        return;
      }
      container.innerHTML = data.topups.map(t => {
        const isAuto = t.gateway === 'flowix';
        const totalRow = isAuto
          ? `<span class="text-gray-400 text-[11px]">Total Bayar (Flowix):</span>`
          : `<span class="text-gray-400 text-[11px]">Total Transfer (Kode Unik ${t.uniqueCode}):</span>`;
        let action = '';
        if (isAuto && t.status === 'Pending') {
          action = `
            <div class="flex gap-2 pt-1">
              <button onclick='openGatewayPaymentModal(${JSON.stringify(t).replace(/'/g, "&#39;")})' class="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-[11px] flex items-center justify-center gap-1 transition">
                <i class="ri-qr-code-line"></i> Buka Pembayaran
              </button>
              <button onclick="checkFlowixStatus('${t.id}', true)" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold rounded-lg text-[11px] transition">
                <i class="ri-refresh-line"></i> Cek
              </button>
            </div>`;
        } else if (!isAuto && t.status === 'Pending') {
          action = `
            <div class="flex gap-2 pt-1">
              <input type="url" id="proof-${t.id}" placeholder="Tempel URL bukti transfer (imgbb/dll)" class="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-pink-500">
              <button onclick="uploadProof('${t.id}')" class="px-3 py-1.5 bg-pink-500 hover:bg-pink-400 text-white font-bold rounded-lg text-[11px]">Upload</button>
            </div>
            ${t.proofUrl ? `<a href="${t.proofUrl}" target="_blank" class="text-[10px] text-cyan-400 underline">Bukti sudah diunggah - lihat</a>` : ''}`;
        } else if (t.proofUrl) {
          action = `<a href="${t.proofUrl}" target="_blank" class="text-[10px] text-cyan-400 underline">Lihat bukti transfer</a>`;
        }
        return `
        <div class="p-3.5 rounded-xl bg-gray-900 border border-gray-800 text-xs space-y-2">
          <div class="flex justify-between items-center">
            <span class="font-mono font-bold text-pink-300 flex items-center gap-1">${isAuto ? '<i class="ri-flashlight-fill text-emerald-400"></i>' : ''}${t.id}</span>
            <span class="px-2 py-0.5 rounded-full font-bold text-[10px] ${t.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : (t.status === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}">${t.status}</span>
          </div>
          <div class="flex justify-between text-gray-300"><span>Metode: <strong class="text-white">${t.paymentMethod}</strong></span><span class="font-bold text-white">Nominal: ${formatRupiah(t.amount)}</span></div>
          <div class="flex justify-between items-center bg-gray-950 p-2 rounded-lg border border-gray-800">
            ${totalRow}
            <span class="font-mono font-black text-emerald-400 text-sm">${formatRupiah(t.totalPay)}</span>
          </div>
          ${action}
        </div>`;
      }).join('');
    }
  } catch (err) {
    console.error('Error load topup:', err);
  }
}

async function uploadProof(topupId) {
  const url = (document.getElementById(`proof-${topupId}`)?.value || '').trim();
  if (!url) { showToast('Masukkan URL bukti transfer terlebih dahulu.', 'warning'); return; }
  try {
    const res = await fetch('/api/topup/upload-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ topupId, proofUrl: url })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadUserTopups();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Gagal upload bukti.', 'error');
  }
}

function switchAdminSubTab(subTabId) {
  document.querySelectorAll('.admin-subcontent').forEach(el => el.classList.add('hidden'));
  ['adm-topups', 'adm-accounts', 'adm-packages', 'adm-vouchers', 'adm-users', 'adm-settings'].forEach(id => {
    const btn = document.getElementById(`admSubBtn-${id}`);
    if (btn) {
      btn.classList.remove('bg-gray-800', 'text-white', 'border-t-2', 'border-pink-500');
      btn.classList.add('text-gray-400');
    }
  });
  const activeTab = document.getElementById(`admSubTab-${subTabId}`);
  const activeBtn = document.getElementById(`admSubBtn-${subTabId}`);
  if (activeTab) activeTab.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.classList.add('bg-gray-800', 'text-white', 'border-t-2', 'border-pink-500');
    activeBtn.classList.remove('text-gray-400');
  }
}

async function loadAdminData() {
  if (!currentUser || currentUser.role !== 'admin') return;
  try {
    const res = await fetch('/api/admin/all-data', { headers: { 'x-user-id': currentUser.id } });
    const data = await res.json();
    if (data.success) {
      document.getElementById('admStatUsers').innerText = data.stats.totalUsers;
      document.getElementById('admStatAccounts').innerText = data.stats.totalAccounts;
      document.getElementById('admStatPendingOrders').innerText = data.stats.pendingOrders || 0;
      document.getElementById('admStatDeposit').innerText = formatRupiah(data.stats.totalDeposit);
      document.getElementById('admStatRevenue').innerText = formatRupiah(data.stats.totalRevenue);
      document.getElementById('admStatPendingDep').innerText = data.stats.pendingDeposit;

      if (data.settings) {
        document.getElementById('settingSiteName').value = data.settings.siteName || '';
        document.getElementById('settingSiteTagline').value = data.settings.siteTagline || '';
        document.getElementById('settingContactWa').value = data.settings.contactWa || '';
        document.getElementById('settingAnnouncement').value = data.settings.announcementText || '';
        document.getElementById('settingMinTopup').value = data.settings.minTopup || 75;
        document.getElementById('settingDeliveryNote').value = data.settings.deliveryNote || '';
        const flxKey = document.getElementById('settingFlowixApiKey');
        if (flxKey) flxKey.value = data.settings.flowixApiKey || '';
        const flxMerchant = document.getElementById('settingFlowixMerchantId');
        if (flxMerchant) flxMerchant.value = data.settings.flowixMerchantId || '';
        const flxSecret = document.getElementById('settingFlowixWebhookSecret');
        if (flxSecret) flxSecret.value = data.settings.flowixWebhookSecret || '';
        const flxActive = document.getElementById('settingFlowixAutoActive');
        if (flxActive) flxActive.checked = data.settings.flowixAutoActive !== false;
        const whUrl = document.getElementById('displayFlowixWebhookUrl');
        if (whUrl) whUrl.innerText = `${window.location.origin}/webhook/flowix`;
      }

      currentAdminPayments = data.payments || [];
      renderAdminPayments();

      renderAdminTopups(data.topups || []);
      renderAdminAccounts(data.orders || []);
      renderAdminPackages(data.packages || []);
      renderAdminVouchers(data.vouchers || []);
      renderAdminUsers(data.users || []);
    }
  } catch (err) {
    console.error('Error load admin data:', err);
  }
}

function renderAdminPayments() {
  const container = document.getElementById('adminPaymentsContainer');
  if (!container) return;
  container.innerHTML = currentAdminPayments.map((p, i) => `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-gray-950 border border-gray-800">
      <div class="sm:col-span-2 flex justify-between items-center">
        <span class="text-[11px] font-bold text-gray-300">${p.name}</span>
        <span class="text-[10px] text-gray-500 font-mono">${p.id}</span>
      </div>
      <input type="text" id="payName-${i}" value="${p.accountName || ''}" placeholder="Atas Nama" class="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-pink-500">
      <input type="text" id="payNumber-${i}" value="${p.accountNumber || ''}" placeholder="Nomor / No Rekening" class="bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-pink-500">
      <input type="text" id="payQr-${i}" value="${p.qrImage || ''}" placeholder="URL gambar QRIS (opsional)" class="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-pink-500">
      <input type="text" id="payInstr-${i}" value="${p.instruction || ''}" placeholder="Instruksi pembayaran" class="sm:col-span-2 bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-pink-500">
    </div>
  `).join('');
}

function renderAdminTopups(topups) {
  const tbody = document.getElementById('admTopupTableBody');
  if (!tbody) return;
  if (topups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-500">Tidak ada tiket deposit.</td></tr>`;
    return;
  }
  tbody.innerHTML = topups.map(t => `
    <tr class="hover:bg-gray-900/40 transition">
      <td class="py-2.5 px-3 font-mono font-bold text-pink-300 text-[11px]">${t.id}</td>
      <td class="py-2.5 px-3 font-bold text-white">${t.username}</td>
      <td class="py-2.5 px-3 text-gray-300">${t.paymentMethod}</td>
      <td class="py-2.5 px-3 font-mono font-bold text-emerald-400">${formatRupiah(t.totalPay)}</td>
      <td class="py-2.5 px-3">${t.proofUrl ? `<a href="${t.proofUrl}" target="_blank" class="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold underline">Lihat</a>` : '<span class="text-gray-500 text-[10px]">-</span>'}</td>
      <td class="py-2.5 px-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : (t.status === 'Rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400')}">${t.status}</span></td>
      <td class="py-2.5 px-3 text-center">
        ${t.status === 'Pending' ? `<div class="flex justify-center space-x-1.5">
          <button onclick="adminActionTopup('${t.id}', 'approve')" class="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded text-[10px] font-bold">Approve</button>
          <button onclick="adminActionTopup('${t.id}', 'reject')" class="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold">Reject</button>
        </div>` : `<span class="text-gray-500 text-[10px]">Selesai</span>`}
      </td>
    </tr>
  `).join('');
}

async function adminActionTopup(topupId, action) {
  if (!confirm(`Yakin ingin ${action.toUpperCase()} deposit tiket ${topupId}?`)) return;
  try {
    const res = await fetch('/api/admin/topup/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ topupId, action })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminData();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Gagal memproses aksi.', 'error');
  }
}

function renderAdminAccounts(orders) {
  const tbody = document.getElementById('admAccountsTableBody');
  if (!tbody) return;
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-500">Belum ada akun terjual.</td></tr>`;
    return;
  }
  tbody.innerHTML = orders.map(o => `
    <tr class="hover:bg-gray-900/40 transition">
      <td class="py-2.5 px-3 font-mono text-[11px] text-pink-300">${o.id}</td>
      <td class="py-2.5 px-3 font-bold text-white">${o.username}</td>
      <td class="py-2.5 px-3 text-gray-300">${o.packageName}</td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-gray-200">${o.accountEmail || '<span class="text-gray-500">-</span>'}</td>
      <td class="py-2.5 px-3 font-mono text-[11px] text-gray-200">${o.accountPassword || '<span class="text-gray-500">-</span>'}</td>
      <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(o.status)}">${statusLabel(o.status)}</span></td>
      <td class="py-2.5 px-3 text-center">
        <div class="flex justify-center gap-1.5">
          <button onclick="openDeliverModal('${o.id}')" class="px-2 py-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white rounded text-[10px] font-bold">Kirim Kredensial</button>
          ${o.status !== 'Cancelled' ? `<button onclick="adminCancelOrder('${o.id}')" class="px-2 py-1 bg-gray-800 hover:bg-red-600 text-gray-200 rounded text-[10px] font-bold">Batal</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function openDeliverModal(orderId) {
  document.getElementById('deliverOrderId').value = orderId;
  document.getElementById('deliverOrderInfo').innerText = `Pesanan ${orderId}`;
  document.getElementById('deliverEmail').value = '';
  document.getElementById('deliverPassword').value = '';
  document.getElementById('deliverNote').value = '';
  openModal('modalAdminDeliver');
}

async function handleDeliverOrder(e) {
  e.preventDefault();
  const orderId = document.getElementById('deliverOrderId').value;
  const accountEmail = document.getElementById('deliverEmail').value.trim();
  const accountPassword = document.getElementById('deliverPassword').value.trim();
  const accountNote = document.getElementById('deliverNote').value.trim();
  try {
    const res = await fetch('/api/admin/orders/deliver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ orderId, accountEmail, accountPassword, accountNote })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modalAdminDeliver');
      loadAdminData();
    } else {
      showToast(data.message || 'Gagal mengirim kredensial.', 'error');
    }
  } catch (err) {
    showToast('Gagal mengirim kredensial.', 'error');
  }
}

async function adminCancelOrder(orderId) {
  if (!confirm(`Batalkan pesanan ${orderId}? Saldo pembeli akan dikembalikan.`)) return;
  try {
    const res = await fetch('/api/admin/orders/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminData(); }
    else showToast(data.message, 'error');
  } catch (err) {
    showToast('Gagal membatalkan pesanan.', 'error');
  }
}

function renderAdminPackages(packages) {
  const tbody = document.getElementById('admPackagesTableBody');
  if (!tbody) return;
  tbody.innerHTML = packages.map(p => {
    const st = Number(p.stock);
    const stBadge = !Number.isFinite(st) ? '<span class="text-gray-500">∞</span>'
      : `<span class="font-mono font-bold ${st > 0 ? 'text-emerald-400' : 'text-red-400'}">${st}</span>`;
    return `
    <tr class="hover:bg-gray-900/40 transition">
      <td class="py-2.5 px-3 font-bold text-white">${p.name}</td>
      <td class="py-2.5 px-3 font-mono text-pink-300">${formatRupiah(p.price)}</td>
      <td class="py-2.5 px-3 text-center">${stBadge}</td>
      <td class="py-2.5 px-3 text-center"><div class="flex justify-center gap-1.5">
        <button onclick='openEditPackageModal(${JSON.stringify(p)})' class="px-2 py-1 bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white rounded text-[10px] font-bold">Edit</button>
        <button onclick="deleteAdminPackage('${p.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px]">Hapus</button>
      </div></td>
    </tr>`;
  }).join('');
}

function openAddPackageModal() {
  document.getElementById('adminPkgId').value = '';
  document.getElementById('adminPkgName').value = '';
  document.getElementById('adminPkgPrice').value = '';
  document.getElementById('adminPkgStock').value = '10';
  document.getElementById('adminPkgDesc').value = '';
  document.getElementById('adminPkgPopular').value = 'false';
  openModal('modalAdminPackage');
}

function openEditPackageModal(p) {
  document.getElementById('adminPkgId').value = p.id;
  document.getElementById('adminPkgName').value = p.name;
  document.getElementById('adminPkgPrice').value = p.price;
  document.getElementById('adminPkgStock').value = Number.isFinite(Number(p.stock)) ? Number(p.stock) : '';
  document.getElementById('adminPkgDesc').value = p.description || '';
  document.getElementById('adminPkgPopular').value = String(!!p.isPopular);
  openModal('modalAdminPackage');
}

async function handleSaveAdminPackage(e) {
  e.preventDefault();
  const payload = {
    id: document.getElementById('adminPkgId').value || undefined,
    name: document.getElementById('adminPkgName').value.trim(),
    price: document.getElementById('adminPkgPrice').value,
    stock: document.getElementById('adminPkgStock').value,
    description: document.getElementById('adminPkgDesc').value.trim(),
    isPopular: document.getElementById('adminPkgPopular').value === 'true'
  };
  try {
    const res = await fetch('/api/admin/packages/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); closeModal('modalAdminPackage'); loadAdminData(); loadPublicInfo(); }
    else showToast(data.message, 'error');
  } catch (err) {
    showToast('Gagal menyimpan produk.', 'error');
  }
}

async function deleteAdminPackage(id) {
  if (!confirm('Hapus produk ini?')) return;
  try {
    const res = await fetch('/api/admin/packages/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminData(); loadPublicInfo(); }
  } catch (err) {
    showToast('Gagal hapus produk.', 'error');
  }
}

function renderAdminVouchers(vouchers) {
  const tbody = document.getElementById('admVouchersTableBody');
  if (!tbody) return;
  if (!vouchers.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-500">Belum ada voucher.</td></tr>`;
    return;
  }
  tbody.innerHTML = vouchers.map(v => `
    <tr class="hover:bg-gray-900/40 transition">
      <td class="py-2 px-3 font-mono font-bold text-emerald-300">${v.code}</td>
      <td class="py-2 px-3 text-white font-bold">${v.type === 'percent' ? v.discount + '%' : formatRupiah(v.discount)}</td>
      <td class="py-2 px-3 text-gray-300">${formatRupiah(v.minOrder || 0)}</td>
      <td class="py-2 px-3 text-center text-gray-400 font-mono">${v.usedCount} / ${v.usageLimit || '∞'}</td>
      <td class="py-2 px-3 text-center"><button onclick="deleteAdminVoucher('${v.code}')" class="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px]">Hapus</button></td>
    </tr>
  `).join('');
}

function openAddVoucherModal() {
  document.getElementById('adminVoucherCode').value = '';
  document.getElementById('adminVoucherType').value = 'percent';
  document.getElementById('adminVoucherDiscount').value = '';
  document.getElementById('adminVoucherMax').value = '';
  document.getElementById('adminVoucherMin').value = '';
  document.getElementById('adminVoucherLimit').value = '';
  openModal('modalAdminVoucher');
}

async function handleSaveAdminVoucher(e) {
  e.preventDefault();
  const payload = {
    code: document.getElementById('adminVoucherCode').value.trim(),
    type: document.getElementById('adminVoucherType').value,
    discount: document.getElementById('adminVoucherDiscount').value,
    maxDiscount: document.getElementById('adminVoucherMax').value,
    minOrder: document.getElementById('adminVoucherMin').value,
    usageLimit: document.getElementById('adminVoucherLimit').value,
    isActive: true
  };
  try {
    const res = await fetch('/api/admin/vouchers/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); closeModal('modalAdminVoucher'); loadAdminData(); }
    else showToast(data.message, 'error');
  } catch (err) {
    showToast('Gagal simpan voucher.', 'error');
  }
}

async function deleteAdminVoucher(code) {
  if (!confirm(`Hapus voucher ${code}?`)) return;
  try {
    const res = await fetch('/api/admin/vouchers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminData(); }
  } catch (err) {
    showToast('Gagal hapus voucher.', 'error');
  }
}

function renderAdminUsers(users) {
  const tbody = document.getElementById('admUsersTableBody');
  if (!tbody) return;
  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-gray-900/40 transition">
      <td class="py-2.5 px-3 font-bold text-white">${u.username}</td>
      <td class="py-2.5 px-3 text-gray-300">${u.fullName || '-'}</td>
      <td class="py-2.5 px-3 font-bold ${u.role === 'admin' ? 'text-amber-400' : 'text-gray-400'} uppercase text-[10px]">${u.role}</td>
      <td class="py-2.5 px-3 font-bold text-emerald-400 font-mono">${formatRupiah(u.balance || 0)}</td>
      <td class="py-2.5 px-3 text-center"><button onclick="promptSetBalance('${u.id}', '${u.username}', ${u.balance || 0})" class="px-2.5 py-1 bg-pink-500/20 hover:bg-pink-500 text-pink-300 hover:text-white rounded text-[10px] font-bold transition">Set Saldo</button></td>
    </tr>
  `).join('');
}

async function promptSetBalance(userId, username, currentBal) {
  const newBal = prompt(`Masukkan jumlah saldo baru untuk @${username}:`, currentBal);
  if (newBal === null || isNaN(newBal)) return;
  try {
    const res = await fetch('/api/admin/users/set-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ targetUserId: userId, newBalance: newBal })
    });
    const data = await res.json();
    if (data.success) { showToast(data.message, 'success'); loadAdminData(); }
  } catch (err) {
    showToast('Gagal ubah saldo user.', 'error');
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();
  const payments = currentAdminPayments.map((p, i) => ({
    id: p.id,
    name: p.name,
    accountName: (document.getElementById(`payName-${i}`)?.value || '').trim(),
    accountNumber: (document.getElementById(`payNumber-${i}`)?.value || '').trim(),
    qrImage: (document.getElementById(`payQr-${i}`)?.value || '').trim() || null,
    instruction: (document.getElementById(`payInstr-${i}`)?.value || '').trim()
  }));

  const payload = {
    siteName: document.getElementById('settingSiteName').value.trim(),
    siteTagline: document.getElementById('settingSiteTagline').value.trim(),
    contactWa: document.getElementById('settingContactWa').value.trim(),
    announcementText: document.getElementById('settingAnnouncement').value.trim(),
    minTopup: document.getElementById('settingMinTopup').value,
    deliveryNote: document.getElementById('settingDeliveryNote').value.trim(),
    flowixApiKey: (document.getElementById('settingFlowixApiKey')?.value || '').trim(),
    flowixMerchantId: (document.getElementById('settingFlowixMerchantId')?.value || '').trim(),
    flowixWebhookSecret: (document.getElementById('settingFlowixWebhookSecret')?.value || '').trim(),
    flowixAutoActive: document.getElementById('settingFlowixAutoActive') ? document.getElementById('settingFlowixAutoActive').checked : true,
    payments
  };

  try {
    const res = await fetch('/api/admin/settings/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      currentAdminPayments = data.payments || currentAdminPayments;
      renderAdminPayments();
      loadPublicInfo();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Gagal menyimpan pengaturan.', 'error');
  }
}

function toggleChatBox() {
  const box = document.getElementById('chatBoxWindow');
  isChatOpen = !isChatOpen;
  if (isChatOpen) {
    box.classList.remove('hidden');
    const nameBox = document.getElementById('guestChatNameBox');
    if (currentUser) nameBox.classList.add('hidden');
    else nameBox.classList.remove('hidden');
    fetchChatMessages();
  } else {
    box.classList.add('hidden');
  }
}

async function fetchChatMessages() {
  try {
    const res = await fetch('/api/chat/messages');
    const data = await res.json();
    if (data.success) {
      if (data.chats.length !== lastChatCount) {
        renderChatMessages(data.chats);
        lastChatCount = data.chats.length;
      }
    }
  } catch (err) { /* ignore */ }
}

function renderChatMessages(chats) {
  const container = document.getElementById('chatMessagesContainer');
  if (!container) return;
  const myId = currentUser ? currentUser.id : getGuestId();
  container.innerHTML = chats.map(c => {
    const mine = c.senderId === myId;
    return `
      <div class="flex ${mine ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[80%] ${mine ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white' : 'bg-gray-800 text-gray-200'} rounded-2xl px-3 py-2">
          ${!mine ? `<p class="text-[9px] font-bold text-pink-300 mb-0.5">${c.role === 'admin' ? 'Admin' : c.senderName}</p>` : ''}
          <p class="text-xs leading-relaxed break-words">${c.message}</p>
          <p class="text-[8px] ${mine ? 'text-pink-100' : 'text-gray-500'} mt-0.5 text-right">${new Date(c.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

function getGuestId() {
  let gid = localStorage.getItem('capcut_guest_id');
  if (!gid) { gid = 'guest_' + Math.random().toString(36).substr(2, 8); localStorage.setItem('capcut_guest_id', gid); }
  return gid;
}

async function handleSendLiveChat(e) {
  e.preventDefault();
  const input = document.getElementById('chatMessageInput');
  const message = input.value.trim();
  if (!message) return;

  const nameInput = document.getElementById('guestChatNameInput');
  const senderName = currentUser ? currentUser.username : (nameInput?.value.trim() || 'Guest');

  try {
    await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentUser ? currentUser.id : getGuestId(),
        senderName,
        role: currentUser ? currentUser.role : 'member',
        message
      })
    });
    input.value = '';
    fetchChatMessages();
  } catch (err) {
    showToast('Gagal mengirim pesan.', 'error');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('capcut_user', JSON.stringify(currentUser));
      updateAuthUI();
      closeModal('modalLogin');
      showToast(data.message, 'success');
      if (currentUser.role === 'admin') switchTab('admin');
      else switchTab('store');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Gagal login.', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const fullName = document.getElementById('regFullName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, password })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modalRegister');
      document.getElementById('loginUsername').value = username;
      openModal('modalLogin');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Gagal mendaftar.', 'error');
  }
}

function logout() {
  currentUser = null;
  localStorage.removeItem('capcut_user');
  updateAuthUI();
  switchTab('store');
  showToast('Anda telah keluar.', 'info');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function formatRupiah(number) {
  return 'Rp ' + (Number(number) || 0).toLocaleString('id-ID');
}

function copyText(elementId) {
  const text = document.getElementById(elementId)?.innerText || '';
  navigator.clipboard.writeText(text).then(() => showToast('Berhasil disalin!', 'success'))
    .catch(() => showToast('Gagal menyalin.', 'error'));
}

let toastTimer = null;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msg = document.getElementById('toastMessage');

  const icons = {
    success: '<i class="ri-checkbox-circle-fill text-emerald-400"></i>',
    error: '<i class="ri-error-warning-fill text-red-400"></i>',
    warning: '<i class="ri-alert-fill text-amber-400"></i>',
    info: '<i class="ri-information-fill text-pink-400"></i>'
  };

  icon.innerHTML = icons[type] || icons.info;
  msg.innerText = message;
  toast.classList.remove('translate-y-20', 'opacity-0');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

window.addEventListener('DOMContentLoaded', initApp);
