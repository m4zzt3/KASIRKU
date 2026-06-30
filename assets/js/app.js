        (function () {
            'use strict';

            let products = [];
            let cart = [];
            let transactions = [];
            let stockInDraft = [];
            let stockInTransactions = [];
            let selectedPaymentMethod = "TUNAI";
            let activeCategory = "Semua";
            let historyMode = "sales";
            let activePage = "dashboard";

            // Temporary State Variable to hold processed image base64
            let tempProductImage = null;
            let activeCameraStream = null;

            // Default system settings state
            let appSettings = {
                storeName: "KasirQu Store",
                storeAddress: "Jl. Raya Kebon Jeruk No. 24",
                storePhone: "(021) 1234-5678",
                receiptFooterText: "Terima Kasih Atas Kunjungan Anda",
                taxPercent: 11,
                categories: ["Makanan", "Minuman", "Cemilan", "Lainnya"]
            };
            let users = [];

            // --- GAS RUNNER HELPER (FETCH API) ---
            const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwziWt9-HMqSH4OJr4VZmv2qpeDsV8vzwkVmyZGNm-C6eExrbJDYUy3z3ouL-wgb2jm/exec";
            
            function gasRun(funcName) {
                var args = Array.prototype.slice.call(arguments, 1);
                return new Promise(function (resolve, reject) {
                    const payload = JSON.stringify({
                        action: funcName,
                        params: args
                    });

                    fetch(GAS_API_URL, {
                        method: 'POST',
                        body: payload,
                        // Gunakan text/plain untuk menghindari CORS Preflight dari browser
                        headers: {
                            'Content-Type': 'text/plain;charset=utf-8'
                        }
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error("HTTP error " + response.status);
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.error) {
                            reject(new Error(data.error));
                        } else {
                            resolve(data.result);
                        }
                    })
                    .catch(error => {
                        console.error("Fetch Error:", error);
                        reject(error);
                    });
                });
            }

            // --- ENHANCED SECURITY AUTH MODULE ---
            var Auth = (function () {
                var _verified = false, _token = null, _user = null, _verifyKey = null;
                return {
                    init: function () {
                        _verifyKey = 'vk_' + Date.now() + '_' + Math.random().toString(36).slice(2);
                        return _verifyKey;
                    },
                    login: function (token, user, key) {
                        if (key !== _verifyKey) return false;
                        _token = token;
                        _user = user;
                        _verified = true;
                        return true;
                    },
                    isVerified: function () {
                        return _verified === true && !!_token && !!_user;
                    },
                    getToken: function () { return _token; },
                    getUser: function () { return _user ? JSON.parse(JSON.stringify(_user)) : null; },
                    getRole: function () { return _user ? _user.role : null; },
                    clear: function () { _verified = false; _token = null; _user = null; }
                };
            })();

            let _authKey = null;

            // --- XSS PROTECTION HELPER ---
            function escapeHTML(str) {
                if (!str) return '';
                var div = document.createElement('div');
                div.appendChild(document.createTextNode(String(str)));
                return div.innerHTML;
            }

            // --- TOAST & FORMATTING UTILS ---
            function showToast(message, type = "success") {
                const container = document.getElementById('toast-container');
                if (!container) return;

                const toast = document.createElement('div');
                toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-white font-medium text-sm transition-all duration-300 transform translate-y-2 opacity-0 z-[9999]`;

                if (type === "success") {
                    toast.classList.add('bg-emerald-600');
                } else if (type === "error") {
                    toast.classList.add('bg-rose-600');
                } else {
                    toast.classList.add('bg-slate-700');
                }

                const icon = type === "success" ? "check-circle" : (type === "error" ? "alert-triangle" : "info");
                toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 shrink-0"></i> <span>${escapeHTML(message)}</span>`;
                container.appendChild(toast);
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }

                setTimeout(() => {
                    toast.classList.remove('translate-y-2', 'opacity-0');
                }, 10);

                setTimeout(() => {
                    toast.classList.add('translate-y-2', 'opacity-0');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
            window.showToast = showToast;

            function formatRupiah(number) {
                return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
            }
            window.formatRupiah = formatRupiah;

            // --- LIFECYCLE INITIALIZER ---
            window.addEventListener('DOMContentLoaded', () => {
                _authKey = Auth.init();
                initClock();
                checkLoginState();
                lucide.createIcons();
            });

            function initClock() {
                const clockEl = document.getElementById('live-clock');
                if (clockEl) {
                    setInterval(() => {
                        const now = new Date();
                        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    }, 1000);
                }
            }

            // --- AUTHENTICATION CONTROLLER ---
            window.handleLoginSubmit = function (e) {
                e.preventDefault();
                const usernameInput = document.getElementById('login-username').value.trim();
                const passwordInput = document.getElementById('login-password').value;

                showFullPageLoading(true);

                gasRun('loginUser', usernameInput, passwordInput)
                    .then(res => {
                        showFullPageLoading(false);
                        if (res.success) {
                            completeLogin(res.token, res.user);
                        } else {
                            showToast(res.message || "Gagal melakukan Login", "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Error sistem: " + err.message, "error");
                    });
            };

            function completeLogin(token, user) {
                const success = Auth.login(token, user, _authKey);
                if (success) {
                    showToast("Sesi dimulai. Selamat datang!", "success");
                    document.getElementById('user-display-name').textContent = user.fullname;
                    document.getElementById('user-display-role').textContent = user.role;
                    document.getElementById('welcome-name').textContent = user.fullname;

                    const mName = document.getElementById('user-mobile-name');
                    const mRole = document.getElementById('user-mobile-role');
                    if (mName) mName.textContent = user.fullname;
                    if (mRole) mRole.textContent = user.role;

                    const addBtn = document.getElementById('add-prod-btn');
                    if (addBtn) {
                        if (user.role !== 'Admin') {
                            addBtn.classList.add('hidden');
                        } else {
                            addBtn.classList.remove('hidden');
                        }
                    }

                    checkLoginState();
                    pullBackendDatabase();
                } else {
                    showToast("Verifikasi otentikasi lokal gagal.", "error");
                }
            }

            window.logout = function () {
                const token = Auth.getToken();
                if (token) {
                    gasRun('destroySession', token);
                }
                Auth.clear();
                checkLoginState();
                showToast("Sesi berakhir.", "info");
            };

            function checkLoginState() {
                const loginPage = document.getElementById('loginPage');
                const mainApp = document.getElementById('mainApp');
                if (!loginPage || !mainApp) return;

                if (Auth.isVerified()) {
                    loginPage.classList.add('d-none');
                    mainApp.classList.remove('d-none');
                    
                    // Show/hide admin menus based on role
                    const role = Auth.getRole();
                    const adminMenus = ['nav-users', 'nav-settings', 'nav-users-mobile', 'nav-settings-mobile'];
                    adminMenus.forEach(id => {
                        const el = document.getElementById(id);
                        if (el) {
                            if (role === 'Admin') {
                                el.classList.remove('hidden');
                            } else {
                                el.classList.add('hidden');
                            }
                        }
                    });

                    showPage('dashboard', document.querySelector('[onclick*="dashboard"]'));
                } else {
                    mainApp.classList.add('d-none');
                    loginPage.classList.remove('d-none');
                    document.getElementById('login-username').value = "";
                    document.getElementById('login-password').value = "";
                }
            }

            function handleSessionExpired(res) {
                if (res && res.sessionExpired) {
                    logout();
                    showToast("Sesi login Anda kedaluwarsa. Silakan masuk kembali.", "error");
                    return true;
                }
                return false;
            }

            // --- BACKEND RECORD SYNCHRONIZER ---
            function pullBackendDatabase() {
                showFullPageLoading(true);

                gasRun('getInitialData', Auth.getToken())
                    .then(res => {
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            products = res.products || [];
                            transactions = res.transactions || [];
                            stockInTransactions = res.stockInTransactions || [];
                            
                            // Fetch settings
                            return gasRun('getSettings', Auth.getToken());
                        } else {
                            showFullPageLoading(false);
                            showToast("Gagal memuat basis data: " + res.message, "error");
                        }
                    })
                    .then(resSettings => {
                        if (!resSettings) return;
                        showFullPageLoading(false);
                        if (resSettings.success && resSettings.settings) {
                            appSettings = resSettings.settings;
                        }
                        refreshAllPageElements();
                        
                        // If admin, pull user list
                        if (Auth.getRole() === 'Admin') {
                            pullUsersList();
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Sistem gagal menarik basis data: " + err.message, "error");
                    });
            }

            function refreshAllPageElements() {
                renderCategories();
                renderProducts();
                renderMgmtProducts();
                updateCartSummary();
                updateStockInProductSelector();
                renderStockInDraft();
                updateProductModalCategorySelect();
                loadPageData(activePage);
            }

            // --- PAGE ISOLATION ROUTER ---
            window.showPage = function (pageName, navEl) {
                if (!Auth.isVerified()) {
                    logout();
                    return;
                }

                activePage = pageName;

                const pageTitles = {
                    'dashboard': 'Dashboard & Ringkasan',
                    'pos': 'Kasir (Point of Sale)',
                    'products': 'Daftar & Kelola Inventaris',
                    'stock-in': 'Input Stok Masuk',
                    'transactions': 'Arsip & Riwayat Transaksi',
                    'reports': 'Laporan Penjualan',
                    'settings': 'Pengaturan Sistem'
                };
                document.getElementById('active-page-title').textContent = pageTitles[pageName] || 'KasirQu';

                document.querySelectorAll('.app-page').forEach(function (page) {
                    page.classList.add('d-none');
                });

                const target = document.getElementById('page-' + pageName);
                if (target) target.classList.remove('d-none');

                document.querySelectorAll('.nav-item-custom').forEach(function (item) {
                    item.className = "nav-item-custom w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-slate-800/50 hover:text-white text-slate-400";
                });

                if (navEl) {
                    navEl.className = "nav-item-custom w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-indigo-400 bg-slate-800 hover:text-white";
                }

                loadPageData(pageName);
            };

            function loadPageData(pageName) {
                if (activePage !== pageName) return;

                if (pageName === 'dashboard') {
                    renderDashboard();
                } else if (pageName === 'pos') {
                    renderProducts();
                } else if (pageName === 'products') {
                    renderMgmtProducts();
                } else if (pageName === 'transactions') {
                    renderTransactionsHistory();
                    renderStockInHistory();
                } else if (pageName === 'reports') {
                    renderReports();
                } else if (pageName === 'settings') {
                    populateSettingsForm();
                    renderSettingsCategories();
                } else if (pageName === 'users') {
                    pullUsersList();
                }
            }

            window.toggleMobileSidebar = function () {
                const sidebar = document.getElementById('sidebar-mobile');
                const backdrop = document.getElementById('mobile-sidebar-backdrop');
                if (sidebar.classList.contains('-translate-x-full')) {
                    sidebar.classList.remove('-translate-x-full');
                    backdrop.classList.remove('hidden');
                } else {
                sidebar.classList.add('-translate-x-full');
                    backdrop.classList.add('hidden');
                }
            };

            // --- SETTINGS CONTROLLERS ---
            function populateSettingsForm() {
                document.getElementById('set-store-name').value = appSettings.storeName || '';
                document.getElementById('set-store-address').value = appSettings.storeAddress || '';
                document.getElementById('set-store-phone').value = appSettings.storePhone || '';
                document.getElementById('set-receipt-footer').value = appSettings.receiptFooterText || '';
                document.getElementById('set-tax-percent').value = appSettings.taxPercent || 0;
            }

            // Mapping handleSaveSettings from index.html form submit
            window.handleSaveSettings = function (e) {
                e.preventDefault();
                const sName = document.getElementById('set-store-name').value.trim();
                const sAddress = document.getElementById('set-store-address').value.trim();
                const sPhone = document.getElementById('set-store-phone').value.trim();
                const sFooter = document.getElementById('set-receipt-footer').value.trim();
                const sTax = parseFloat(document.getElementById('set-tax-percent').value);

                if (!sName || isNaN(sTax) || sTax < 0) {
                    showToast("Isi data pengaturan profil & pajak dengan benar!", "error");
                    return;
                }

                showFullPageLoading(true);

                const newSettings = {
                    storeName: sName,
                    storeAddress: sAddress,
                    storePhone: sPhone,
                    receiptFooterText: sFooter,
                    taxPercent: sTax,
                    categories: appSettings.categories
                };

                gasRun('saveSettings', Auth.getToken(), newSettings)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            appSettings = newSettings;
                            showToast("Pengaturan berhasil disimpan ke Google Sheets!", "success");
                            refreshAllPageElements();
                        } else {
                            showToast("Gagal menyimpan pengaturan: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            window.renderSettingsCategories = function () {
                const listContainer = document.getElementById('settings-categories-list');
                if (!listContainer) return;

                listContainer.innerHTML = appSettings.categories.map(cat => `
                    <div class="flex items-center justify-between p-2 px-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <span class="text-xs font-bold text-slate-700">${escapeHTML(cat)}</span>
                        <button onclick="deleteSettingsCategory('${escapeHTML(cat)}')" class="p-1 hover:bg-rose-100 text-rose-600 rounded-lg transition-all">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                `).join('');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            };

            // Mapping handleAddCategory from index.html
            window.handleAddCategory = function () {
                const input = document.getElementById('new-category-input');
                const catName = input.value.trim();
                if (!catName) {
                    showToast("Nama kategori tidak boleh kosong!", "error");
                    return;
                }

                if (appSettings.categories.includes(catName)) {
                    showToast("Kategori sudah terdaftar!", "error");
                    return;
                }

                showFullPageLoading(true);
                const updatedCategories = [...appSettings.categories, catName];
                const newSettings = { ...appSettings, categories: updatedCategories };

                gasRun('saveSettings', Auth.getToken(), newSettings)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            appSettings.categories = updatedCategories;
                            input.value = "";
                            showToast(`Kategori "${catName}" berhasil ditambahkan!`, "success");
                            renderSettingsCategories();
                            refreshAllPageElements();
                        } else {
                            showToast("Gagal menambah kategori: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            window.deleteSettingsCategory = function (catName) {
                showCustomConfirm(`Apakah Anda yakin ingin menghapus kategori "${catName}"?`, () => {
                    showFullPageLoading(true);
                    const updatedCategories = appSettings.categories.filter(c => c !== catName);
                    const newSettings = { ...appSettings, categories: updatedCategories };

                    gasRun('saveSettings', Auth.getToken(), newSettings)
                        .then(res => {
                            showFullPageLoading(false);
                            if (handleSessionExpired(res)) return;

                            if (res.success) {
                                appSettings.categories = updatedCategories;
                                showToast(`Kategori "${catName}" berhasil dihapus.`, "success");
                                renderSettingsCategories();
                                refreshAllPageElements();
                            } else {
                                showToast("Gagal menghapus kategori: " + res.message, "error");
                            }
                        })
                        .catch(err => {
                            showFullPageLoading(false);
                            showToast("Koneksi gagal: " + err.message, "error");
                        });
                });
            };

            function updateProductModalCategorySelect() {
                const selectEl = document.getElementById('prod-category');
                if (selectEl) {
                    selectEl.innerHTML = appSettings.categories.map(cat => `
                        <option value="${cat}">${escapeHTML(cat)}</option>
                    `).join('');
                }
            }

            window.forceDatabaseSync = function () {
                showCustomConfirm("Ini akan mengunduh ulang seluruh database Anda dari Google Sheet. Lanjutkan?", () => {
                    pullBackendDatabase();
                    showToast("Database disinkronisasi paksa!", "success");
                });
            };

            // --- USER MANAGEMENT CONTROLLERS ---
            function pullUsersList() {
                gasRun('getUsers', Auth.getToken())
                    .then(res => {
                        if (res.success) {
                            users = res.users || [];
                            renderUsers();
                        }
                    })
                    .catch(err => {
                        console.error("Gagal menarik daftar user:", err);
                    });
            }

            function renderUsers() {
                const tbody = document.getElementById('users-table-body');
                if (!tbody) return;

                if (users.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-400">Tidak ada data pengguna.</td></tr>`;
                    return;
                }

                tbody.innerHTML = users.map(u => {
                    const isSystemAdmin = u.username.toLowerCase() === 'admin';
                    const actionButtons = isSystemAdmin ? 
                        `<span class="text-xs text-slate-400 font-semibold italic">Sistem Utama</span>` : 
                        `<button onclick="editUser('${escapeHTML(u.username)}')" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex items-center transition-colors"><i data-lucide="edit" class="w-4 h-4"></i></button>
                         <button onclick="deleteUser('${escapeHTML(u.username)}')" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center transition-colors"><i data-lucide="trash" class="w-4 h-4"></i></button>`;

                    return `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-4 px-6 font-semibold text-slate-800">${escapeHTML(u.fullname)}</td>
                            <td class="py-4 px-6 text-slate-500">${escapeHTML(u.username)}</td>
                            <td class="py-4 px-6">
                                <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${u.role === 'Admin' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}">
                                    ${escapeHTML(u.role)}
                                </span>
                            </td>
                            <td class="py-4 px-6 text-right space-x-2">
                                ${actionButtons}
                            </td>
                        </tr>
                    `;
                }).join('');

                if (typeof lucide !== 'undefined') lucide.createIcons();
            }

            window.openUserModal = function (isEdit = false) {
                document.getElementById('user-modal-title').textContent = isEdit ? "Ubah Detail User" : "Tambah User Baru";
                document.getElementById('user-modal').classList.remove('hidden');
                document.getElementById('edit-user-is-edit').value = isEdit ? "true" : "false";

                const usernameInput = document.getElementById('user-username');
                const passwordLabel = document.getElementById('user-password-label');
                const passwordHelp = document.getElementById('user-password-help');

                if (isEdit) {
                    usernameInput.disabled = true; // Username cannot be changed
                    passwordLabel.textContent = "Password Baru";
                    passwordHelp.classList.remove('hidden');
                    document.getElementById('user-password').required = false;
                } else {
                    usernameInput.disabled = false;
                    passwordLabel.textContent = "Password";
                    passwordHelp.classList.add('hidden');
                    document.getElementById('user-password').required = true;
                    
                    document.getElementById('user-fullname').value = "";
                    usernameInput.value = "";
                    document.getElementById('user-password').value = "";
                    document.getElementById('user-role').value = "Staff";
                }
            };

            window.closeUserModal = function () {
                document.getElementById('user-modal').classList.add('hidden');
            };

            window.handleSaveUser = function (e) {
                e.preventDefault();
                const isEdit = document.getElementById('edit-user-is-edit').value === "true";
                const fullname = document.getElementById('user-fullname').value.trim();
                const username = document.getElementById('user-username').value.trim();
                const password = document.getElementById('user-password').value;
                const role = document.getElementById('user-role').value;

                if (!fullname || !username || (!isEdit && !password)) {
                    showToast("Semua kolom wajib diisi!", "error");
                    return;
                }

                showFullPageLoading(true);

                const payload = {
                    username: username,
                    fullname: fullname,
                    role: role
                };

                gasRun('saveUser', Auth.getToken(), payload, password || null)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            showToast(isEdit ? "User berhasil diperbarui!" : "User baru berhasil ditambahkan!", "success");
                            closeUserModal();
                            pullUsersList();
                        } else {
                            showToast("Gagal menyimpan user: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            window.editUser = function (usernameVal) {
                const u = users.find(u => u.username === usernameVal);
                if (!u) return;

                document.getElementById('user-fullname').value = u.fullname;
                document.getElementById('user-username').value = u.username;
                document.getElementById('user-password').value = "";
                document.getElementById('user-role').value = u.role;

                window.openUserModal(true);
            };

            window.deleteUser = function (usernameVal) {
                showCustomConfirm(`Apakah Anda yakin ingin menghapus user dengan username "${usernameVal}"?`, () => {
                    showFullPageLoading(true);

                    gasRun('deleteUser', Auth.getToken(), usernameVal)
                        .then(res => {
                            showFullPageLoading(false);
                            if (handleSessionExpired(res)) return;

                            if (res.success) {
                                showToast(`User "${usernameVal}" berhasil dihapus.`, "success");
                                pullUsersList();
                            } else {
                                showToast("Gagal menghapus user: " + res.message, "error");
                            }
                        })
                        .catch(err => {
                            showFullPageLoading(false);
                            showToast("Koneksi gagal: " + err.message, "error");
                        });
                });
            };

            // --- CUSTOM MODALS & STAGES ---
            let onConfirmProceed = null;
            function showCustomConfirm(message, proceedCallback) {
                document.getElementById('confirm-modal-message').textContent = message;
                const modal = document.getElementById('custom-confirm-modal');
                modal.classList.remove('hidden');

                onConfirmProceed = () => {
                    proceedCallback();
                    modal.classList.add('hidden');
                };

                document.getElementById('btn-confirm-cancel').onclick = () => {
                    modal.classList.add('hidden');
                };
                document.getElementById('btn-confirm-proceed').onclick = onConfirmProceed;
            }

            function showFullPageLoading(show) {
                const loader = document.getElementById('fullPageLoader');
                if (loader) {
                    if (show) loader.classList.remove('hidden');
                    else loader.classList.add('hidden');
                }
            }

            // ================= DASHBOARD CONTROLLER =================
            function renderDashboard() {
                const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                const todayTrx = transactions.filter(t => t.date.includes(today.substring(0, 8)));
                const todayRevenue = todayTrx.reduce((sum, t) => sum + t.values.grandTotal, 0);
                const todayItemsCount = todayTrx.reduce((sum, t) => sum + t.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

                document.getElementById('dash-revenue').textContent = formatRupiah(todayRevenue);
                document.getElementById('dash-transactions').textContent = todayTrx.length;
                document.getElementById('dash-items-sold').textContent = todayItemsCount + " Pcs";

                const lowStockItems = products.filter(p => p.stock < 15);
                document.getElementById('dash-low-stock-count').textContent = lowStockItems.length;

                const lowStockContainer = document.getElementById('dash-stock-alerts');
                if (lowStockItems.length === 0) {
                    lowStockContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-6 text-slate-400">
                            <i data-lucide="shield-check" class="w-10 h-10 mb-2 text-emerald-500"></i>
                            <p class="text-xs font-semibold">Semua stok aman</p>
                        </div>
                    `;
                } else {
                    lowStockContainer.innerHTML = lowStockItems.map(item => {
                        const isBase64 = item.emoji && item.emoji.startsWith('data:image');
                        const visualHtml = isBase64 ?
                            `<img src="${item.emoji}" class="w-full h-full object-cover rounded-xl">` :
                            `<span class="text-lg">${escapeHTML(item.emoji)}</span>`;
                        return `
                            <div class="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-100/60">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">${visualHtml}</div>
                                    <div>
                                        <h5 class="font-bold text-slate-800 text-xs">${escapeHTML(item.name)}</h5>
                                        <p class="text-[10px] text-slate-400 font-bold uppercase leading-none mt-1">${escapeHTML(item.category)}</p>
                                    </div>
                                </div>
                                <span class="bg-rose-100 text-rose-700 text-xs font-black px-2.5 py-1 rounded-lg">Stok: ${item.stock}</span>
                            </div>
                        `;
                    }).join('');
                }

                const recentActContainer = document.getElementById('dash-recent-activities');
                const mergedActivities = [];

                transactions.slice(0, 5).forEach(t => {
                    mergedActivities.push({
                        id: t.id,
                        date: t.date,
                        type: 'Penjualan',
                        val: t.values.grandTotal,
                        method: t.method
                    });
                });

                stockInTransactions.slice(0, 5).forEach(st => {
                    mergedActivities.push({
                        id: st.id,
                        date: st.date,
                        type: 'Stok Masuk',
                        val: st.totalCost,
                        method: st.supplier
                    });
                });

                mergedActivities.sort((a, b) => b.id.localeCompare(a.id));

                if (mergedActivities.length === 0) {
                    recentActContainer.innerHTML = `
                        <tr>
                            <td colspan="5" class="py-10 text-center text-slate-400 text-xs font-bold">Belum ada aktivitas transaksi hari ini.</td>
                        </tr>
                    `;
                } else {
                    recentActContainer.innerHTML = mergedActivities.slice(0, 5).map(act => `
                        <tr class="hover:bg-slate-50/40 transition-colors">
                            <td class="py-3 font-mono font-bold text-xs text-indigo-600">${escapeHTML(act.id)}</td>
                            <td class="py-3 text-xs text-slate-500">${escapeHTML(act.date)}</td>
                            <td class="py-3 text-xs">
                                <span class="inline-block px-2.5 py-0.5 rounded-full font-bold ${act.type === 'Penjualan' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}">
                                    ${escapeHTML(act.type)}
                                </span>
                            </td>
                            <td class="py-3 text-xs font-extrabold text-slate-800">${formatRupiah(act.val)}</td>
                            <td class="py-3 text-right">
                                <button onclick="viewActivityDetails('${escapeHTML(act.id)}', '${escapeHTML(act.type)}')" class="p-1 text-slate-400 hover:text-indigo-600 rounded-lg">
                                    <i data-lucide="eye" class="w-4 h-4 inline"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('');
                }

                renderDashboardChart();
                lucide.createIcons();
            }

            function renderDashboardChart() {
                const chartContainer = document.getElementById('dash-svg-chart-container');
                const daysLabel = [];
                const salesValues = [];

                for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dayStr = d.toLocaleDateString('id-ID', { weekday: 'short' });
                    daysLabel.push(dayStr);

                    const dateKey = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                    const dayTrx = transactions.filter(t => t.date.includes(dateKey.substring(0, 8)));
                    const sum = dayTrx.reduce((total, t) => total + t.values.grandTotal, 0);

                    salesValues.push(sum);
                }

                const maxVal = Math.max(...salesValues, 300000);

                chartContainer.innerHTML = salesValues.map((val, idx) => {
                    const percent = (val / maxVal) * 100;
                    return `
                        <div class="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                            <div class="relative w-full flex justify-center h-full items-end">
                                <div class="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-black py-1 px-2 rounded shadow-md z-10 whitespace-nowrap">
                                    ${formatRupiah(val)}
                                </div>
                                <div class="w-8 sm:w-10 bg-indigo-500 group-hover:bg-indigo-600 rounded-t-xl transition-all duration-300 shadow-sm" style="height: ${percent}%"></div>
                            </div>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">${escapeHTML(daysLabel[idx])}</span>
                        </div>
                    `;
                }).join('');
            }

            window.viewActivityDetails = function (id, type) {
                if (type === 'Penjualan') {
                    reprintReceipt(id);
                } else {
                    showStockInDetails(id);
                }
            };

            // --- POS INTERFACE CONTROLLERS ---
            function renderCategories() {
                const container = document.getElementById('pos-categories');

                // Read from appSettings dynamically
                const categories = ["Semua", ...appSettings.categories];

                container.innerHTML = categories.map(cat => {
                    const isActive = activeCategory === cat;
                    return `
                        <button onclick="selectCategory('${escapeHTML(cat)}')" class="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}" >
                            ${escapeHTML(cat)}
                        </button>
                    `;
                }).join('');
            }

            window.selectCategory = function (category) {
                activeCategory = category;
                renderCategories();
                renderProducts();
            };

            function renderProducts() {
                const grid = document.getElementById('product-grid');
                const searchQuery = document.getElementById('pos-search').value.toLowerCase();

                const filtered = products.filter(p => {
                    const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
                    const matchSearch = p.name.toLowerCase().includes(searchQuery);
                    return matchCategory && matchSearch;
                });

                const emptyState = document.getElementById('empty-products-state');
                if (filtered.length === 0) {
                    grid.innerHTML = "";
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                    return;
                } else {
                    emptyState.classList.add('hidden');
                    emptyState.classList.remove('flex');
                }

                grid.innerHTML = filtered.map(p => {
                    const isOutOfStock = p.stock <= 0;

                    const cartItem = cart.find(item => item.product.id === p.id);
                    const qtyBadgeHtml = (cartItem && cartItem.quantity > 0) ? `
                        <div class="absolute top-3 right-3 bg-indigo-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-full shadow-md border border-white flex items-center gap-1 animate-in zoom-in duration-150">
                            <i data-lucide="shopping-cart" class="w-3 h-3"></i>
                            <span>${cartItem.quantity}</span>
                        </div>
                    ` : '';

                    // Check if p.emoji holds a base64 encoded string or a traditional emoji
                    const isBase64 = p.emoji && p.emoji.startsWith('data:image');
                    const mediaHtml = isBase64 ?
                        `<img src="${p.emoji}" class="w-full h-full object-cover">` :
                        `<span>${escapeHTML(p.emoji) || "📦"}</span>`;

                    return `
                        <div onclick="${isOutOfStock ? '' : `addToCart(${p.id})`}" class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer relative overflow-hidden group ${isOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}">
                            ${isOutOfStock ? `
                                <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] flex items-center justify-center z-10">
                                    <span class="bg-rose-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-md">Habis</span>
                                </div>
                            ` : ''}
                            
                            ${qtyBadgeHtml}

                            <div>
                                <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl mb-3 shadow-inner overflow-hidden group-hover:scale-110 transition-transform">
                                    ${mediaHtml}
                                </div>
                                <h4 class="font-bold text-slate-800 text-sm line-clamp-2 leading-tight">${escapeHTML(p.name)}</h4>
                                <span class="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full mt-1.5">${escapeHTML(p.category)}</span>
                            </div>
                            <div class="mt-4 flex items-center justify-between">
                                <div>
                                    <p class="text-xs text-slate-400 font-semibold">Harga</p>
                                    <p class="font-extrabold text-slate-900 text-sm">${formatRupiah(p.price)}</p>
                                </div>
                                <div class="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md">Stok: ${p.stock}</div>
                            </div>
                        </div>
                    `;
                }).join('');

                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }

            window.filterProducts = function () {
                renderProducts();
            };

            // --- POS CART SYSTEMS ---
            window.addToCart = function (productId) {
                const product = products.find(p => p.id === productId);
                if (!product) return;

                const existingCartItem = cart.find(item => item.product.id === productId);
                const currentQuantity = existingCartItem ? existingCartItem.quantity : 0;

                if (currentQuantity >= product.stock) {
                    showToast(`Stok ${product.name} terbatas! Tidak bisa menambah lagi.`, "error");
                    return;
                }

                if (existingCartItem) {
                    existingCartItem.quantity += 1;
                } else {
                    cart.push({ product, quantity: 1, discountType: 'PERCENT', discountValue: 0 });
                }

                renderProducts();
                updateCartSummary();
            };

            window.updateCartQuantity = function (productId, newQty) {
                const product = products.find(p => p.id === productId);
                const item = cart.find(i => i.product.id === productId);
                if (!item || !product) return;

                if (newQty <= 0) {
                    cart = cart.filter(i => i.product.id !== productId);
                } else if (newQty > product.stock) {
                    showToast(`Stok ${product.name} terbatas! Maksimal ${product.stock}.`, "error");
                    item.quantity = product.stock;
                } else {
                    item.quantity = newQty;
                }

                renderProducts();
                updateCartSummary();
            };

            window.clearCart = function () {
                if (cart.length === 0) return;
                cart = [];
                renderProducts();
                updateCartSummary();
                showToast("Keranjang dibersihkan", "success");
            };

            // --- CUSTOM MODAL SET DISKON PER PRODUK ---
            let currentModalDiscountType = 'PERCENT';

            window.setDiscountTypeTab = function (type) {
                currentModalDiscountType = type;
                const tabPercent = document.getElementById('tab-disc-percent');
                const tabNominal = document.getElementById('tab-disc-nominal');
                const prefix = document.getElementById('discount-modal-prefix');
                const suffix = document.getElementById('discount-modal-suffix');
                const input = document.getElementById('discount-modal-value');

                if (type === 'PERCENT') {
                    tabPercent.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-sm transition-all";
                    tabNominal.className = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all";
                    prefix.classList.add('hidden');
                    suffix.classList.remove('hidden');
                    input.className = "w-full pl-4 pr-10 py-3 border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 rounded-xl text-base font-black text-slate-800";
                    input.placeholder = "0 - 100";
                } else {
                    tabNominal.className = "flex-1 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-sm transition-all";
                    tabPercent.className = "flex-1 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all";
                    prefix.classList.remove('hidden');
                    suffix.classList.add('hidden');
                    input.className = "w-full pl-11 pr-4 py-3 border-2 border-slate-200 focus:border-indigo-500 focus:ring-0 rounded-xl text-base font-black text-slate-800";
                    input.placeholder = "0";
                }
            };

            window.openDiscountModal = function (productId) {
                const item = cart.find(i => i.product.id === productId);
                if (!item) return;

                document.getElementById('discount-modal-product-name').textContent = item.product.name;
                document.getElementById('discount-modal-product-id').value = productId;

                const type = item.discountType || 'PERCENT';
                const val = item.discountValue || 0;

                document.getElementById('discount-modal-value').value = val;
                setDiscountTypeTab(type);

                document.getElementById('discount-modal').classList.remove('hidden');
            };

            window.closeDiscountModal = function () {
                document.getElementById('discount-modal').classList.add('hidden');
            };

            window.saveItemDiscount = function () {
                const productId = parseInt(document.getElementById('discount-modal-product-id').value);
                const discValue = parseFloat(document.getElementById('discount-modal-value').value);

                if (isNaN(discValue) || discValue < 0) {
                    showToast("Nilai diskon tidak boleh kosong atau negatif!", "error");
                    return;
                }

                const item = cart.find(i => i.product.id === productId);
                if (item) {
                    const maxAllowed = item.product.price * item.quantity;
                    if (currentModalDiscountType === 'PERCENT' && discValue > 100) {
                        showToast("Persentase diskon maksimal adalah 100%!", "error");
                        return;
                    }
                    if (currentModalDiscountType === 'NOMINAL' && discValue > maxAllowed) {
                        showToast(`Diskon nominal tidak boleh melebihi total harga item (${formatRupiah(maxAllowed)})!`, "error");
                        return;
                    }

                    item.discountType = currentModalDiscountType;
                    item.discountValue = discValue;

                    const labelStr = currentModalDiscountType === 'PERCENT' ? `${discValue}%` : formatRupiah(discValue);
                    showToast(`Diskon untuk "${item.product.name}" diatur ke ${labelStr}!`, "success");
                    updateCartSummary();
                }

                closeDiscountModal();
            };

            function updateCartSummary() {
                const cartList = document.getElementById('cart-list');
                const cartCount = document.getElementById('cart-count');

                if (cart.length === 0) {
                    cartList.innerHTML = `
                        <div class="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                            <i data-lucide="shopping-cart" class="w-12 h-12 mb-3 text-slate-300"></i>
                            <p class="font-semibold text-slate-500">Keranjang Kosong</p>
                            <p class="text-[11px]">Tambahkan produk dari menu di samping.</p>
                        </div>
                    `;
                    cartCount.textContent = "0";
                    document.getElementById('btn-pay').disabled = true;

                    document.getElementById('summary-subtotal').textContent = "Rp 0";
                    document.getElementById('summary-discount').textContent = "-Rp 0";
                    document.getElementById('summary-tax').textContent = "Rp 0";
                    document.getElementById('summary-total').textContent = "Rp 0";

                    lucide.createIcons();
                    return;
                }

                document.getElementById('btn-pay').disabled = false;

                let totalItems = 0;
                let subtotal = 0;
                let totalDiscountAmount = 0;

                cartList.innerHTML = cart.map(item => {
                    totalItems += item.quantity;

                    const originalPriceTotal = item.product.price * item.quantity;
                    subtotal += originalPriceTotal;

                    let itemDiscount = 0;
                    if (item.discountType === 'PERCENT') {
                        itemDiscount = originalPriceTotal * ((item.discountValue || 0) / 100);
                    } else if (item.discountType === 'NOMINAL') {
                        itemDiscount = Math.min(item.discountValue || 0, originalPriceTotal);
                    }
                    totalDiscountAmount += itemDiscount;
                    const finalItemPrice = originalPriceTotal - itemDiscount;

                    const hasDiscount = itemDiscount > 0;
                    const discountBadgeHtml = hasDiscount ? (
                        item.discountType === 'PERCENT' ?
                            `<span class="text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md">Disc ${item.discountValue}%</span>` :
                            `<span class="text-[9px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded-md font-bold truncate block max-w-[120px]">Potongan -${formatRupiah(item.discountValue)}</span>`
                    ) : '';

                    const isBase64 = item.product.emoji && item.product.emoji.startsWith('data:image');
                    const imageHtml = isBase64 ?
                        `<img src="${item.product.emoji}" class="w-full h-full object-cover">` :
                        `<span>${escapeHTML(item.product.emoji) || "🍔"}</span>`;

                    return `
                        <div class="flex flex-col gap-2.5 bg-white p-3.5 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all shadow-sm">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xl shadow-inner overflow-hidden shrink-0">
                                    ${imageHtml}
                                </div>
                                <div class="flex-1 min-w-0">
                                    <h5 class="font-bold text-slate-800 text-xs truncate leading-tight">${escapeHTML(item.product.name)}</h5>
                                    <div class="flex items-center gap-1.5 mt-1">
                                        <span class="text-[10px] text-slate-400 font-semibold">${formatRupiah(item.product.price)}</span>
                                        ${discountBadgeHtml}
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 shrink-0 bg-slate-100 p-1 rounded-xl">
                                    <button onclick="updateCartQuantity(${item.product.id}, ${item.quantity - 1})" class="p-1 rounded-lg bg-white text-slate-600 hover:text-slate-800 hover:shadow-sm transition-all"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
                                    <input type="number" value="${item.quantity}" onchange="updateCartQuantity(${item.product.id}, parseInt(this.value))" class="w-7 text-center bg-transparent text-xs font-bold text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none">
                                    <button onclick="updateCartQuantity(${item.product.id}, ${item.quantity + 1})" class="p-1 rounded-lg bg-white text-slate-600 hover:text-slate-800 hover:shadow-sm transition-all"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                                </div>
                            </div>
                            
                            <div class="flex justify-between items-center pt-2 border-t border-dashed border-slate-100">
                                <button onclick="openDiscountModal(${item.product.id})" class="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 py-1 px-2 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 transition-colors">
                                    <i data-lucide="tag" class="w-3 h-3"></i>
                                    <span>Set Diskon</span>
                                </button>
                                <div class="text-right">
                                    ${hasDiscount ? `
                                        <span class="text-[10px] line-through text-slate-400 block leading-none mb-1">${formatRupiah(originalPriceTotal)}</span>
                                        <span class="text-xs font-extrabold text-slate-900">${formatRupiah(finalItemPrice)}</span>
                                    ` : `
                                        <span class="text-xs font-extrabold text-slate-900">${formatRupiah(originalPriceTotal)}</span>
                                    `}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                cartCount.textContent = totalItems;

                const totalAfterDiscount = subtotal - totalDiscountAmount;
                const taxPercentValue = appSettings.taxPercent || 0;
                const taxAmount = totalAfterDiscount * (taxPercentValue / 100);
                const grandTotal = totalAfterDiscount + taxAmount;

                document.getElementById('summary-subtotal').textContent = formatRupiah(subtotal);
                document.getElementById('summary-discount').textContent = `- ${formatRupiah(totalDiscountAmount)}`;
                document.getElementById('summary-tax-rate').textContent = taxPercentValue;
                document.getElementById('summary-tax').textContent = formatRupiah(taxAmount);
                document.getElementById('summary-total').textContent = formatRupiah(grandTotal);

                window.currentCheckoutValues = {
                    subtotal,
                    discountPercent: 0,
                    discountAmount: totalDiscountAmount,
                    taxAmount,
                    grandTotal
                };

                lucide.createIcons();
            }

            // --- PAYMENTS & INVOICES ---
            window.openPaymentModal = function () {
                if (cart.length === 0) return;
                const values = window.currentCheckoutValues;

                document.getElementById('payment-modal-total').textContent = formatRupiah(values.grandTotal);
                document.getElementById('payment-modal').classList.remove('hidden');

                document.getElementById('cash-amount').value = "";
                document.getElementById('payment-change').textContent = "Rp 0";
                selectPaymentMethod("TUNAI");
            };

            window.closePaymentModal = function () {
                document.getElementById('payment-modal').classList.add('hidden');
            };

            window.selectPaymentMethod = function (method) {
                selectedPaymentMethod = method;

                document.querySelectorAll('.pay-method-btn').forEach(btn => {
                    btn.className = "pay-method-btn py-3 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl font-bold text-sm flex flex-col items-center gap-1.5 transition-all";
                });

                const activeBtn = document.getElementById(`btn-pay-${method.toLowerCase()}`);
                activeBtn.className = "pay-method-btn py-3 border-2 border-indigo-600 bg-indigo-50/50 text-indigo-700 rounded-xl font-bold text-sm flex flex-col items-center gap-1.5 transition-all";

                const cashInputContainer = document.getElementById('cash-input-container');
                const changeContainer = document.getElementById('change-container');

                if (method === 'TUNAI') {
                    cashInputContainer.classList.remove('hidden');
                    changeContainer.classList.remove('hidden');
                    calculateChange();
                } else {
                    cashInputContainer.classList.add('hidden');
                    changeContainer.classList.add('hidden');
                }
            };

            window.fillExactCash = function () {
                const targetTotal = window.currentCheckoutValues.grandTotal;
                document.getElementById('cash-amount').value = Math.ceil(targetTotal);
                calculateChange();
            };

            window.quickCash = function (amount) {
                const currentCash = parseFloat(document.getElementById('cash-amount').value) || 0;
                document.getElementById('cash-amount').value = currentCash + amount;
                calculateChange();
            };

            window.calculateChange = function () {
                const targetTotal = window.currentCheckoutValues.grandTotal;
                const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;

                const change = cashAmount - targetTotal;
                const changeEl = document.getElementById('payment-change');

                if (change < 0) {
                    changeEl.textContent = "Kurang " + formatRupiah(Math.abs(change));
                    changeEl.classList.add('text-rose-600');
                    changeEl.classList.remove('text-slate-800', 'text-emerald-600');
                } else {
                    changeEl.textContent = formatRupiah(change);
                    changeEl.classList.remove('text-rose-600', 'text-slate-800');
                    changeEl.classList.add('text-emerald-600');
                }
            };

            window.processTransaction = function () {
                const values = window.currentCheckoutValues;
                const cashAmount = parseFloat(document.getElementById('cash-amount').value) || 0;
                const change = cashAmount - values.grandTotal;

                if (selectedPaymentMethod === 'TUNAI' && change < 0) {
                    showToast("Jumlah uang tunai yang diterima kurang!", "error");
                    return;
                }

                showFullPageLoading(true);

                const transactionId = "TRX-" + Date.now().toString().slice(-8);
                const now = new Date();
                const formattedDate = now.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                const payload = {
                    id: transactionId,
                    date: formattedDate,
                    items: cart.map(c => ({
                        id: c.product.id,
                        name: c.product.name,
                        price: c.product.price,
                        quantity: c.quantity,
                        emoji: c.product.emoji,
                        category: c.product.category,
                        discountType: c.discountType || 'PERCENT',
                        discountValue: c.discountValue || 0
                    })),
                    values: values,
                    method: selectedPaymentMethod,
                    cashPaid: selectedPaymentMethod === 'TUNAI' ? cashAmount : values.grandTotal,
                    change: selectedPaymentMethod === 'TUNAI' ? change : 0
                };

                gasRun('processTransaction', Auth.getToken(), payload)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            showToast("Transaksi Berhasil!", "success");
                            pullBackendDatabase();
                            showReceipt(payload);
                            resetCartAfterCheckout();
                        } else {
                            showToast("Pembayaran Gagal: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            function resetCartAfterCheckout() {
                cart = [];
                renderProducts();
                updateCartSummary();
                closePaymentModal();
            }

            function showReceipt(trx) {
                document.getElementById('rec-store-name').textContent = appSettings.storeName;
                document.getElementById('rec-store-address').textContent = appSettings.storeAddress;
                document.getElementById('rec-store-phone').textContent = "Telp: " + appSettings.storePhone;
                document.getElementById('rec-store-footer').textContent = appSettings.receiptFooterText;

                document.getElementById('rec-id').textContent = trx.id;
                document.getElementById('rec-date').textContent = trx.date;
                document.getElementById('rec-cashier-name').textContent = Auth.getUser() ? Auth.getUser().fullname : "Kasir";

                const itemsContainer = document.getElementById('rec-items');
                itemsContainer.innerHTML = trx.items.map(item => {
                    const originalPriceTotal = item.price * item.quantity;

                    let itemDiscountAmount = 0;
                    if (item.discountType === 'PERCENT') {
                        itemDiscountAmount = originalPriceTotal * ((item.discountValue || 0) / 100);
                    } else if (item.discountType === 'NOMINAL') {
                        itemDiscountAmount = item.discountValue || 0;
                    }

                    const rowFinalPrice = originalPriceTotal - itemDiscountAmount;

                    let discountLabel = '';
                    if (itemDiscountAmount > 0) {
                        discountLabel = item.discountType === 'PERCENT' ? ` (Disc ${item.discountValue}%)` : ` (Pot. -${formatRupiah(item.discountValue)})`;
                    }

                    return `
                        <div class="space-y-0.5">
                            <div class="flex justify-between font-bold text-slate-800">
                                <span>${escapeHTML(item.name)}${discountLabel}</span>
                                <span>${formatRupiah(rowFinalPrice)}</span>
                            </div>
                            <div class="text-slate-500">
                                <span>${item.quantity} x ${formatRupiah(item.price)}</span>
                            </div>
                        </div>
                    `;
                }).join('');

                document.getElementById('rec-subtotal').textContent = formatRupiah(trx.values.subtotal);
                document.getElementById('rec-discount').textContent = `-Rp ${trx.values.discountAmount.toLocaleString('id-ID')}`;
                document.getElementById('rec-tax-rate').textContent = appSettings.taxPercent;
                document.getElementById('rec-tax').textContent = formatRupiah(trx.values.taxAmount);
                document.getElementById('rec-total').textContent = formatRupiah(trx.values.grandTotal);

                document.getElementById('rec-method-label').textContent = trx.method === 'TUNAI' ? "Bayar (Tunai):" : `Bayar (${trx.method}):`;
                document.getElementById('rec-pay').textContent = formatRupiah(trx.cashPaid);
                document.getElementById('rec-change').textContent = formatRupiah(trx.change);

                document.getElementById('receipt-modal').classList.remove('hidden');
            }

            window.closeReceiptModal = function () {
                document.getElementById('receipt-modal').classList.add('hidden');
            };

            window.printReceipt = function () {
                const printContent = document.getElementById('receipt-print-area').outerHTML;
                const printWindow = window.open('', '', 'height=600,width=400');
                printWindow.document.write('<html><head><title>Struk Pembayaran</title>');
                printWindow.document.write('<style>body{font-family:monospace;padding:20px;color:#333;width:300px;margin:0 auto;} .flex{display:flex;justify-content:space-between;} .text-center{text-align:center;} .border-b{border-bottom:1px dashed #ccc;padding-bottom:10px;margin-bottom:10px;} .space-y{margin-bottom:6px;}</style>');
                printWindow.document.write('</head><body>');
                printWindow.document.write(printContent);
                printWindow.document.write('</body></html>');
                printWindow.document.close();

                setTimeout(() => {
                    printWindow.print();
                    printWindow.close();
                }, 500);

                showToast("Mengirim ke printer...", "success");
            };

            // --- CAMERA & LOCAL FILE IMAGE CONTROLLERS ---
            window.triggerLocalFileUpload = function () {
                const fileInput = document.getElementById('prod-image-file');
                if (fileInput) fileInput.click();
            };

            window.handleImageUpload = function (event) {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function (e) {
                    const img = new Image();
                    img.onload = function () {
                        compressAndSetImage(img, false);
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            };

            window.toggleCameraStream = async function () {
                const panel = document.getElementById('camera-stream-panel');
                const btn = document.getElementById('btn-camera-toggle');

                if (activeCameraStream) {
                    stopCamera();
                    panel.classList.add('hidden');
                    btn.innerHTML = `<i data-lucide="camera" class="w-3.5 h-3.5"></i> Gunakan Kamera`;
                    lucide.createIcons();
                } else {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({
                            video: { width: 320, height: 240, facingMode: "environment" },
                            audio: false
                        });
                        activeCameraStream = stream;

                        const video = document.getElementById('camera-preview');
                        video.srcObject = stream;
                        video.play();

                        panel.classList.remove('hidden');
                        btn.innerHTML = `<i data-lucide="camera-off" class="w-3.5 h-3.5"></i> Matikan Kamera`;
                        lucide.createIcons();
                    } catch (err) {
                        showToast("Gagal mengakses kamera perangkat: " + err.message, "error");
                        console.error(err);
                    }
                }
            };

            function stopCamera() {
                if (activeCameraStream) {
                    activeCameraStream.getTracks().forEach(track => track.stop());
                    activeCameraStream = null;
                }
                const panel = document.getElementById('camera-stream-panel');
                if (panel) panel.classList.add('hidden');

                const btn = document.getElementById('btn-camera-toggle');
                if (btn) {
                    btn.innerHTML = `<i data-lucide="camera" class="w-3.5 h-3.5"></i> Gunakan Kamera`;
                    lucide.createIcons();
                }
            }

            window.capturePhotoFromStream = function () {
                const video = document.getElementById('camera-preview');
                if (!activeCameraStream || video.paused) {
                    showToast("Aliran kamera belum aktif!", "error");
                    return;
                }
                compressAndSetImage(video, true);
                showToast("Gambar diambil dari kamera!", "success");
            };

            function compressAndSetImage(source, isVideo = false) {
                const canvas = document.getElementById('capture-canvas');
                const ctx = canvas.getContext('2d');

                // Downsample to low res 120x120 for extreme space optimization
                const size = 120;
                canvas.width = size;
                canvas.height = size;

                if (isVideo) {
                    const video = source;
                    const minDim = Math.min(video.videoWidth, video.videoHeight);
                    const sx = (video.videoWidth - minDim) / 2;
                    const sy = (video.videoHeight - minDim) / 2;
                    ctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, size, size);
                } else {
                    const img = source;
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                }

                // Compress heavily to keep inside sheet limits (Quality: 0.55) -> 3KB-6KB base64
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.55);
                tempProductImage = compressedBase64;

                // Render Preview Frame
                document.getElementById('image-preview-display').innerHTML = `<img src="${compressedBase64}" class="w-full h-full object-cover">`;

                // Release Camera Resource
                stopCamera();
            }

            // --- PRODUCT INVENTORIES (CRUD) ---
            window.filterMgmtProducts = function () {
                renderMgmtProducts();
            };

            function renderMgmtProducts() {
                const tableBody = document.getElementById('mgmt-product-table');
                const searchQuery = document.getElementById('mgmt-search').value.toLowerCase();

                const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery));

                tableBody.innerHTML = filtered.map(p => {
                    const isBase64 = p.emoji && p.emoji.startsWith('data:image');
                    const visualHtml = isBase64 ?
                        `<img src="${p.emoji}" class="w-full h-full object-cover">` :
                        `<span>${escapeHTML(p.emoji) || "🍔"}</span>`;
                    return `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-4 px-6 flex items-center gap-3">
                                <span class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg overflow-hidden shrink-0">${visualHtml}</span>
                                <span class="font-semibold text-slate-800">${escapeHTML(p.name)}</span>
                            </td>
                            <td class="py-4 px-6 text-slate-500">${escapeHTML(p.category)}</td>
                            <td class="py-4 px-6 font-bold text-slate-900">${formatRupiah(p.price)}</td>
                            <td class="py-4 px-6">
                                <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${p.stock > 15 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}">
                                    ${p.stock} pcs
                                </span>
                            </td>
                            <td class="py-4 px-6 text-right space-x-2">
                                <button onclick="editProduct(${p.id})" class="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg inline-flex items-center transition-colors"><i data-lucide="edit" class="w-4 h-4"></i></button>
                                <button onclick="deleteProduct(${p.id})" class="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center transition-colors"><i data-lucide="trash" class="w-4 h-4"></i></button>
                            </td>
                        </tr>
                    `;
                }).join('');

                lucide.createIcons();
            }

            window.openProductModal = function (isEdit = false) {
                document.getElementById('product-modal-title').textContent = isEdit ? "Ubah Detail Produk" : "Tambah Produk Baru";
                document.getElementById('product-modal').classList.remove('hidden');

                updateProductModalCategorySelect();
                stopCamera();

                if (!isEdit) {
                    document.getElementById('edit-product-id').value = "";
                    document.getElementById('prod-name').value = "";
                    document.getElementById('prod-category').value = appSettings.categories[0] || "Lainnya";
                    document.getElementById('prod-emoji').value = "🍔";
                    document.getElementById('prod-price').value = "";
                    document.getElementById('prod-stock').value = "";
                    tempProductImage = null;
                    document.getElementById('image-preview-display').innerHTML = "🍔";
                }
            };

            window.closeProductModal = function () {
                stopCamera();
                document.getElementById('product-modal').classList.add('hidden');
            };

            window.saveProduct = function () {
                const id = document.getElementById('edit-product-id').value;
                const name = document.getElementById('prod-name').value.trim();
                const category = document.getElementById('prod-category').value;
                const emojiFieldVal = document.getElementById('prod-emoji').value.trim();
                const price = parseFloat(document.getElementById('prod-price').value);
                const stock = parseInt(document.getElementById('prod-stock').value);

                if (!name || isNaN(price) || isNaN(stock)) {
                    showToast("Semua kolom harus diisi dengan benar!", "error");
                    return;
                }

                showFullPageLoading(true);

                // Use tempProductImage (base64) if uploaded, else fallback to standard emoji text field
                const emojiPayload = tempProductImage ? tempProductImage : emojiFieldVal;

                const payload = {
                    id: id ? parseInt(id) : null,
                    name: name,
                    category: category,
                    emoji: emojiPayload,
                    price: price,
                    stock: stock
                };

                gasRun('saveProduct', Auth.getToken(), payload)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            showToast("Produk berhasil disimpan!", "success");
                            pullBackendDatabase();
                            closeProductModal();
                        } else {
                            showToast("Gagal menyimpan produk: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            window.editProduct = function (productId) {
                const p = products.find(p => p.id === productId);
                if (!p) return;

                document.getElementById('edit-product-id').value = p.id;
                document.getElementById('prod-name').value = p.name;
                document.getElementById('prod-category').value = p.category;
                document.getElementById('prod-price').value = p.price;
                document.getElementById('prod-stock').value = p.stock;

                const isBase64 = p.emoji && p.emoji.startsWith('data:image');
                if (isBase64) {
                    tempProductImage = p.emoji;
                    document.getElementById('prod-emoji').value = "";
                    document.getElementById('image-preview-display').innerHTML = `<img src="${p.emoji}" class="w-full h-full object-cover">`;
                } else {
                    tempProductImage = null;
                    document.getElementById('prod-emoji').value = p.emoji || "🍔";
                    document.getElementById('image-preview-display').innerHTML = escapeHTML(p.emoji) || "🍔";
                }

                window.openProductModal(true);
            };

            window.deleteProduct = function (productId) {
                const index = products.findIndex(p => p.id === productId);
                if (index === -1) return;

                const name = products[index].name;

                showCustomConfirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`, () => {
                    showFullPageLoading(true);

                    gasRun('deleteProduct', Auth.getToken(), productId)
                        .then(res => {
                            showFullPageLoading(false);
                            if (handleSessionExpired(res)) return;

                            if (res.success) {
                                showToast(`Produk "${name}" berhasil dihapus`, "success");
                                pullBackendDatabase();
                                cart = cart.filter(i => i.product.id !== productId);
                                updateCartSummary();
                            } else {
                                showToast("Gagal menghapus produk: " + res.message, "error");
                            }
                        })
                        .catch(err => {
                            showFullPageLoading(false);
                            showToast("Koneksi gagal: " + err.message, "error");
                        });
                });
            };

            // --- STOK MASUK (Faktur) SYSTEMS ---
            function updateStockInProductSelector() {
                const selectEl = document.getElementById('stockin-product-select');
                if (!selectEl) return;

                selectEl.innerHTML = products.map(p => {
                    const labelText = p.emoji && p.emoji.startsWith('data:image') ? "🖼️" : p.emoji;
                    return `
                        <option value="${p.id}">${labelText} ${escapeHTML(p.name)} (Stok Saat Ini: ${p.stock})</option>
                    `;
                }).join('');
            }

            window.addStockInItemDraft = function () {
                const selectEl = document.getElementById('stockin-product-select');
                const qtyInput = document.getElementById('stockin-qty');
                const buyPriceInput = document.getElementById('stockin-buy-price');

                const productId = parseInt(selectEl.value);
                const qty = parseInt(qtyInput.value);
                const buyPrice = parseFloat(buyPriceInput.value);

                if (!productId) {
                    showToast("Pilih produk terlebih dahulu!", "error");
                    return;
                }
                if (isNaN(qty) || qty <= 0) {
                    showToast("Jumlah masuk harus berupa angka lebih besar dari 0!", "error");
                    return;
                }
                if (isNaN(buyPrice) || buyPrice < 0) {
                    showToast("Harga beli tidak boleh negatif!", "error");
                    return;
                }

                const product = products.find(p => p.id === productId);
                if (!product) return;

                const existingIndex = stockInDraft.findIndex(item => item.product.id === productId);
                if (existingIndex !== -1) {
                    stockInDraft[existingIndex].quantity += qty;
                    stockInDraft[existingIndex].buyPrice = buyPrice;
                } else {
                    stockInDraft.push({
                        product: { ...product },
                        quantity: qty,
                        buyPrice: buyPrice
                    });
                }

                showToast(`${product.name} masuk ke draft faktur`, "success");

                qtyInput.value = "";
                buyPriceInput.value = "";

                renderStockInDraft();
            };

            window.removeStockInDraftItem = function (index) {
                stockInDraft.splice(index, 1);
                renderStockInDraft();
                showToast("Item dihapus dari draft", "success");
            };

            window.clearStockInDraft = function () {
                if (stockInDraft.length === 0) return;
                stockInDraft = [];
                renderStockInDraft();
                showToast("Semua draft item dibersihkan", "success");
            };

            function renderStockInDraft() {
                const tbody = document.getElementById('stockin-draft-table');
                const emptyState = document.getElementById('stockin-empty-draft-state');
                const grandTotalEl = document.getElementById('stockin-draft-grandtotal');
                const btnSubmit = document.getElementById('btn-submit-stockin');

                if (stockInDraft.length === 0) {
                    tbody.innerHTML = "";
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                    grandTotalEl.textContent = "Rp 0";
                    btnSubmit.disabled = true;
                    return;
                }

                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');
                btnSubmit.disabled = false;

                let grandTotal = 0;

                tbody.innerHTML = stockInDraft.map((item, index) => {
                    const totalCost = item.quantity * item.buyPrice;
                    grandTotal += totalCost;

                    const isBase64 = item.product.emoji && item.product.emoji.startsWith('data:image');
                    const visualHtml = isBase64 ?
                        `<img src="${item.product.emoji}" class="w-full h-full object-cover">` :
                        `<span class="text-base">${escapeHTML(item.product.emoji)}</span>`;

                    return `
                        <tr class="hover:bg-slate-50/50 transition-colors">
                            <td class="py-3 px-6 flex items-center gap-3">
                                <span class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">${visualHtml}</span>
                                <div>
                                    <p class="font-semibold text-slate-800 leading-tight">${escapeHTML(item.product.name)}</p>
                                    <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold uppercase">${escapeHTML(item.product.category)}</span>
                                </div>
                            </td>
                            <td class="py-3 px-6 text-center font-bold text-slate-800">${item.quantity} pcs</td>
                            <td class="py-3 px-6 font-semibold text-slate-700">${formatRupiah(item.buyPrice)}</td>
                            <td class="py-3 px-6 font-extrabold text-indigo-600">${formatRupiah(totalCost)}</td>
                            <td class="py-3 px-6 text-right">
                                <button onclick="removeStockInDraftItem(${index})" class="p-1 text-rose-600 hover:bg-rose-50 rounded-lg inline-flex items-center transition-colors">
                                    <i data-lucide="x" class="w-4 h-4"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                grandTotalEl.textContent = formatRupiah(grandTotal);
                window.currentStockInTotal = grandTotal;

                lucide.createIcons();
            }

            window.submitStockInInvoice = function () {
                const invoiceNoInput = document.getElementById('stockin-invoice-no');
                const supplierInput = document.getElementById('stockin-supplier');

                const invoiceNo = invoiceNoInput.value.trim() || "FC-" + Date.now().toString().slice(-6);
                const supplier = supplierInput.value.trim() || "Supplier Umum";

                if (stockInDraft.length === 0) {
                    showToast("Faktur masih kosong!", "error");
                    return;
                }

                showFullPageLoading(true);

                const payload = {
                    id: invoiceNo,
                    supplier: supplier,
                    items: stockInDraft.map(s => ({ id: s.product.id, name: s.product.name, emoji: s.product.emoji, category: s.product.category, quantity: s.quantity, buyPrice: s.buyPrice })),
                    totalCost: window.currentStockInTotal
                };

                gasRun('submitStockInInvoice', Auth.getToken(), payload)
                    .then(res => {
                        showFullPageLoading(false);
                        if (handleSessionExpired(res)) return;

                        if (res.success) {
                            showToast("Stok berhasil diperbarui!", "success");
                            pullBackendDatabase();
                            stockInDraft = [];
                            invoiceNoInput.value = "";
                            supplierInput.value = "";
                            showPage('transactions', document.querySelector('[onclick*="transactions"]'));
                            switchHistoryMode('stock-in');
                        } else {
                            showToast("Gagal menyimpan faktur: " + res.message, "error");
                        }
                    })
                    .catch(err => {
                        showFullPageLoading(false);
                        showToast("Koneksi gagal: " + err.message, "error");
                    });
            };

            // --- HISTORY LISTS CONTROLLERS ---
            window.switchHistoryMode = function (mode) {
                historyMode = mode;
                const btnSales = document.getElementById('btn-hist-sales');
                const btnStockIn = document.getElementById('btn-hist-stockin');

                const salesContainer = document.getElementById('sales-history-container');
                const stockInContainer = document.getElementById('stockin-history-container');

                if (mode === 'sales') {
                    btnSales.className = "px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-sm transition-all";
                    btnStockIn.className = "px-4 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all";
                    salesContainer.classList.remove('hidden');
                    stockInContainer.classList.add('hidden');
                    renderTransactionsHistory();
                } else {
                    btnStockIn.className = "px-4 py-1.5 text-xs font-bold rounded-lg bg-white text-slate-900 shadow-sm transition-all";
                    btnSales.className = "px-4 py-1.5 text-xs font-bold rounded-lg text-slate-600 hover:text-slate-950 transition-all";
                    stockInContainer.classList.remove('hidden');
                    salesContainer.classList.add('hidden');
                    renderStockInHistory();
                }
            };

            function renderTransactionsHistory() {
                const tableBody = document.getElementById('transaction-history-table');
                const emptyState = document.getElementById('empty-transactions-state');
                const descEl = document.getElementById('empty-transactions-desc');

                if (historyMode !== 'sales') return;

                if (transactions.length === 0) {
                    tableBody.innerHTML = "";
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                    descEl.textContent = "Selesaikan transaksi di tab kasir untuk melihat riwayat di sini.";
                    return;
                }

                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');

                tableBody.innerHTML = transactions.map(trx => `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="py-4 px-6 font-mono font-semibold text-indigo-600">${escapeHTML(trx.id)}</td>
                        <td class="py-4 px-6 text-slate-500">${escapeHTML(trx.date)}</td>
                        <td class="py-4 px-6">
                            <span class="inline-block px-2.5 py-1 rounded-full text-xs font-bold ${trx.method === 'TUNAI' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}">
                                ${escapeHTML(trx.method)}
                            </span>
                        </td>
                        <td class="py-4 px-6 font-bold text-slate-900">${formatRupiah(trx.values.grandTotal)}</td>
                        <td class="py-4 px-6 text-slate-600">${formatRupiah(trx.cashPaid)}</td>
                        <td class="py-4 px-6 text-slate-600">${formatRupiah(trx.change)}</td>
                        <td class="py-4 px-6 text-right">
                            <button onclick="reprintReceipt('${escapeHTML(trx.id)}')" class="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto transition-all">
                                <i data-lucide="printer" class="w-3.5 h-3.5"></i> Detail & Struk
                            </button>
                        </td>
                    </tr>
                `).join('');

                lucide.createIcons();
            }

            function renderStockInHistory() {
                const tableBody = document.getElementById('stockin-history-table');
                const emptyState = document.getElementById('empty-transactions-state');
                const descEl = document.getElementById('empty-transactions-desc');

                if (historyMode !== 'stock-in') return;

                if (stockInTransactions.length === 0) {
                    tableBody.innerHTML = "";
                    emptyState.classList.remove('hidden');
                    emptyState.classList.add('flex');
                    descEl.textContent = "Input faktur pembelian di tab Stok Masuk untuk melihat riwayat di sini.";
                    return;
                }

                emptyState.classList.add('hidden');
                emptyState.classList.remove('flex');

                tableBody.innerHTML = stockInTransactions.map(trx => {
                    const totalItemCount = trx.items.reduce((sum, item) => sum + item.quantity, 0);
                    return `
                        <tr class="hover:bg-slate-50 transition-colors">
                            <td class="py-4 px-6 font-mono font-semibold text-indigo-600">${escapeHTML(trx.id)}</td>
                            <td class="py-4 px-6 text-slate-500">${escapeHTML(trx.date)}</td>
                            <td class="py-4 px-6 text-slate-800 font-semibold">${escapeHTML(trx.supplier)}</td>
                            <td class="py-4 px-6 font-bold text-slate-600">${totalItemCount} pcs (${trx.items.length} macam)</td>
                            <td class="py-4 px-6 font-bold text-indigo-600">${formatRupiah(trx.totalCost)}</td>
                            <td class="py-4 px-6 text-right">
                                <button onclick="showStockInDetails('${escapeHTML(trx.id)}')" class="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 ml-auto transition-all">
                                    <i data-lucide="eye" class="w-3.5 h-3.5"></i> Lihat Faktur
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                lucide.createIcons();
            }

            window.showStockInDetails = function (invoiceNo) {
                const trx = stockInTransactions.find(t => t.id === invoiceNo);
                if (!trx) return;

                document.getElementById('det-stockin-id').textContent = trx.id;
                document.getElementById('det-stockin-date').textContent = trx.date;
                document.getElementById('det-stockin-supplier').textContent = trx.supplier;
                document.getElementById('det-stockin-total').textContent = formatRupiah(trx.totalCost);

                const itemsContainer = document.getElementById('det-stockin-items');
                itemsContainer.innerHTML = trx.items.map(item => {
                    const isBase64 = item.emoji && item.emoji.startsWith('data:image');
                    const visualHtml = isBase64 ?
                        `<img src="${item.emoji}" class="w-full h-full object-cover">` :
                        `<span>${escapeHTML(item.emoji) || "📦"}</span>`;

                    return `
                        <div class="flex items-center justify-between p-3 hover:bg-slate-50">
                            <div class="flex items-center gap-2">
                                <span class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">${visualHtml}</span>
                                <div>
                                    <p class="font-bold text-slate-800 text-xs">${escapeHTML(item.name)}</p>
                                    <p class="text-[10px] text-slate-400">Harga Satuan: ${formatRupiah(item.buyPrice)}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-xs font-bold text-slate-800">${item.quantity} pcs</p>
                                <p class="text-xs font-semibold text-indigo-600">${formatRupiah(item.quantity * item.buyPrice)}</p>
                            </div>
                        </div>
                    `;
                }).join('');

                document.getElementById('stockin-detail-modal').classList.remove('hidden');
                lucide.createIcons();
            };

            window.closeStockInDetailModal = function () {
                document.getElementById('stockin-detail-modal').classList.add('hidden');
            };

            window.reprintReceipt = function (trxId) {
                const trx = transactions.find(t => t.id === trxId);
                if (trx) {
                    showReceipt(trx);
                }
            };

            // --- ANALYTICS & STATS ---
            function renderReports() {
                const totalRevenue = transactions.reduce((sum, trx) => sum + trx.values.grandTotal, 0);
                const totalTrx = transactions.length;
                const itemsSold = transactions.reduce((sum, trx) => {
                    return sum + trx.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
                }, 0);
                const avgTicket = totalTrx > 0 ? (totalRevenue / totalTrx) : 0;

                document.getElementById('stat-revenue').textContent = formatRupiah(totalRevenue);
                document.getElementById('stat-transactions').textContent = totalTrx;
                document.getElementById('stat-items-sold').textContent = `${itemsSold} Pcs`;
                document.getElementById('stat-avg-ticket').textContent = formatRupiah(avgTicket);

                const sellingStats = {};
                transactions.forEach(trx => {
                    trx.items.forEach(item => {
                        const name = item.name;
                        const emoji = item.emoji || "🍔";
                        if (!sellingStats[name]) {
                            sellingStats[name] = { name, emoji, qty: 0, revenue: 0 };
                        }
                        sellingStats[name].qty += item.quantity;

                        const itemOriginalValue = item.price * item.quantity;
                        let itemDiscountAmount = 0;
                        if (item.discountType === 'PERCENT') {
                            itemDiscountAmount = itemOriginalValue * ((item.discountValue || 0) / 100);
                        } else if (item.discountType === 'NOMINAL') {
                            itemDiscountAmount = item.discountValue || 0;
                        }
                        sellingStats[name].revenue += (itemOriginalValue - itemDiscountAmount);
                    });
                });

                const sortedBestSellers = Object.values(sellingStats).sort((a, b) => b.qty - a.qty);
                const bestSellerList = document.getElementById('best-selling-list');

                if (sortedBestSellers.length === 0) {
                    bestSellerList.innerHTML = `<p class="text-sm text-slate-400 text-center py-6">Belum ada data penjualan.</p>`;
                } else {
                    bestSellerList.innerHTML = sortedBestSellers.map((item, idx) => {
                        const isBase64 = item.emoji && item.emoji.startsWith('data:image');
                        const visualHtml = isBase64 ?
                            `<img src="${item.emoji}" class="w-full h-full object-cover">` :
                            `<span>${escapeHTML(item.emoji)}</span>`;
                        return `
                            <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div class="flex items-center gap-3">
                                    <span class="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">#${idx + 1}</span>
                                    <span class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">${visualHtml}</span>
                                    <div>
                                        <h5 class="font-bold text-slate-800 text-sm">${escapeHTML(item.name)}</h5>
                                        <span class="text-xs text-slate-400">Total terjual: <b>${item.qty} pcs</b></span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="font-extrabold text-slate-800 text-sm">${formatRupiah(item.revenue)}</p>
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                const paymentStats = { TUNAI: 0, QRIS: 0, DEBIT: 0 };
                transactions.forEach(trx => {
                    paymentStats[trx.method] += trx.values.grandTotal;
                });

                const methodContainer = document.getElementById('payment-methods-stats');
                const totalPayMethods = Object.values(paymentStats).reduce((a, b) => a + b, 0);

                methodContainer.innerHTML = Object.entries(paymentStats).map(([method, val]) => {
                    const percent = totalPayMethods > 0 ? Math.round((val / totalPayMethods) * 100) : 0;

                    let colorClass = "bg-amber-500";
                    if (method === "QRIS") colorClass = "bg-emerald-500";
                    if (method === "DEBIT") colorClass = "bg-indigo-500";

                    return `
                        <div class="space-y-1.5">
                            <div class="flex justify-between text-sm font-semibold text-slate-700">
                                <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full ${colorClass}"></span>${escapeHTML(method)}</span>
                                <span>${percent}% (${formatRupiah(val)})</span>
                            </div>
                            <div class="w-full bg-slate-100 rounded-full h-2">
                                <div class="${colorClass} h-2 rounded-full" style="width: ${percent}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        })();
        console.log('App generated using GAS WebApp Builder');
