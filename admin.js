// admin.js – All admin dashboard functions (approvals, users, treasure, settings, plans, news)

// Helper: show toast message
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = isError ? '#ef4444' : '#2ecc71';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = '9999';
    toast.style.fontWeight = 'bold';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ============= STATS =============
async function loadStats() {
    const usersSnap = await db.collection('users').get();
    document.getElementById('totalUsers').innerText = usersSnap.size;
    const depositsSnap = await db.collection('deposits').where('status', '==', 'pending').get();
    document.getElementById('pendingDeposits').innerText = depositsSnap.size;
    const withdrawalsSnap = await db.collection('withdrawals').where('status', '==', 'pending').get();
    document.getElementById('pendingWithdrawals').innerText = withdrawalsSnap.size;
    const loansSnap = await db.collection('loans').where('status', '==', 'active').get();
    document.getElementById('pendingLoans').innerText = loansSnap.size;
}

// ============= DEPOSITS =============
async function loadPendingDeposits() {
    const snapshot = await db.collection('deposits').where('status', '==', 'pending').orderBy('createdAt', 'desc').get();
    let html = '<table></table><th>User ID</th><th>Amount</th><th>Method</th><th>Phone</th><th>Screenshot</th><th>User Time</th><th>Action</th></tr>';
    snapshot.forEach(doc => {
        const data = doc.data();
        const userTime = data.userProvidedTimestamp ? data.userProvidedTimestamp.toDate().toLocaleString() : '-';
        html += `<tr>
            <td>${data.userId.slice(0,8)}...</td>
            <td>K${data.amount}</td>
            <td>${data.paymentMethod}</td>
            <td>${data.phone || '-'}</td>
            <td>${data.screenshotUrl ? `<a href="${data.screenshotUrl}" target="_blank">View</a>` : '-'}</td>
            <td>${userTime}</td>
            <td><button class="btn-small" onclick="approveDeposit('${doc.id}', ${data.amount}, '${data.userId}')">Approve</button>
            <button class="btn-small danger" onclick="rejectDeposit('${doc.id}')">Reject</button></td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('pendingDepositsList').innerHTML = html || '<p>No pending deposits.</p>';
}

async function loadCompletedDeposits() {
    const snapshot = await db.collection('deposits').where('status', '==', 'completed').orderBy('createdAt', 'desc').limit(10).get();
    let html = 'ables\n<tr><th>User</th><th>Amount</th><th>Date</th></tr>';
    snapshot.forEach(doc => {
        const data = doc.data();
        html += `<tr>
            <td>${data.userId.slice(0,8)}...</td>
            <td>K${data.amount}</td>
            <td>${data.createdAt?.toDate().toLocaleString() || '-'}</td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('completedDepositsList').innerHTML = html;
}

window.approveDeposit = async (id, amount, userId) => {
    await db.runTransaction(async (t) => {
        const depRef = db.collection('deposits').doc(id);
        t.update(depRef, { status: 'completed' });
        const userRef = db.collection('users').doc(userId);
        const userSnap = await t.get(userRef);
        t.update(userRef, { balance: (userSnap.data().balance || 0) + amount });
    });
    showToast('Deposit approved');
    loadPendingDeposits();
    loadStats();
    loadCompletedDeposits();
};

window.rejectDeposit = async (id) => {
    await db.collection('deposits').doc(id).update({ status: 'rejected' });
    showToast('Deposit rejected');
    loadPendingDeposits();
    loadStats();
};

// ============= WITHDRAWALS =============
async function loadPendingWithdrawals() {
    const snapshot = await db.collection('withdrawals').where('status', '==', 'pending').orderBy('createdAt', 'desc').get();
    let html = 'ables\n<tr><th>User ID</th><th>Amount</th><th>Net Amount</th><th>Network</th><th>Contact</th><th>Action</th></tr>';
    snapshot.forEach(doc => {
        const data = doc.data();
        html += `<tr>
            <td>${data.userId.slice(0,8)}...</td>
            <td>K${data.amount}</td>
            <td>K${data.netAmount || data.amount}</td>
            <td>${data.network}</td>
            <td>${data.phone || data.cardNumber || '-'}</td>
            <td><button class="btn-small" onclick="approveWithdrawal('${doc.id}', ${data.amount}, '${data.userId}')">Approve</button>
            <button class="btn-small danger" onclick="rejectWithdrawal('${doc.id}')">Reject</button></td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('pendingWithdrawalsList').innerHTML = html || '<p>No pending withdrawals.</p>';
}

window.approveWithdrawal = async (id, amount, userId) => {
    await db.runTransaction(async (t) => {
        const wRef = db.collection('withdrawals').doc(id);
        t.update(wRef, { status: 'completed' });
        const userRef = db.collection('users').doc(userId);
        const userSnap = await t.get(userRef);
        const newBalance = (userSnap.data().balance || 0) - amount;
        if (newBalance < 0) throw new Error('Insufficient balance');
        t.update(userRef, { balance: newBalance });
    });
    showToast('Withdrawal approved');
    loadPendingWithdrawals();
    loadStats();
};

window.rejectWithdrawal = async (id) => {
    await db.collection('withdrawals').doc(id).update({ status: 'rejected' });
    showToast('Withdrawal rejected');
    loadPendingWithdrawals();
    loadStats();
};

// ============= LOANS =============
async function loadActiveLoans() {
    const snapshot = await db.collection('loans').where('status', '==', 'active').orderBy('createdAt', 'desc').get();
    let html = 'ables\n<tr><th>User ID</th><th>Amount</th><th>Repay Total</th><th>Due Date</th><th>Action</th></tr>';
    snapshot.forEach(doc => {
        const data = doc.data();
        html += `<tr>
            <td>${data.userId.slice(0,8)}...</td>
            <td>K${data.amount}</td>
            <td>K${data.repayTotal}</td>
            <td>${data.dueDate?.toDate().toLocaleDateString() || '-'}</td>
            <td><button class="btn-small" onclick="markLoanPaid('${doc.id}')">Mark Paid</button></td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('activeLoansList').innerHTML = html;
}

window.markLoanPaid = async (id) => {
    await db.collection('loans').doc(id).update({ status: 'paid' });
    showToast('Loan marked as paid');
    loadActiveLoans();
    loadStats();
};

// ============= USERS =============
async function loadAllUsers() {
    const snapshot = await db.collection('users').get();
    let html = '';
    for (const doc of snapshot.docs) {
        const user = doc.data();
        html += `
            <div class="user-row">
                <div><strong>${user.fullName || 'No name'}</strong><br><small>${user.email}</small><br>Balance: K${user.balance || 0}</div>
                <div class="user-actions">
                    <div class="edit-balance">
                        <input type="number" id="balanceInput-${doc.id}" placeholder="Amount">
                        <button class="btn-small" onclick="updateBalance('${doc.id}', document.getElementById('balanceInput-${doc.id}').value)">Set</button>
                        <button class="btn-small warning" onclick="addBalance('${doc.id}', document.getElementById('balanceInput-${doc.id}').value)">Add</button>
                        <button class="btn-small danger" onclick="subtractBalance('${doc.id}', document.getElementById('balanceInput-${doc.id}').value)">Subtract</button>
                    </div>
                    <button class="btn-small" onclick="resetUserPassword('${user.email}')">Reset Password</button>
                    <button class="btn-small ${user.isBlocked ? 'warning' : 'danger'}" onclick="toggleBlockUser('${doc.id}', ${user.isBlocked})">${user.isBlocked ? 'Unblock' : 'Block'}</button>
                    ${user.role !== 'admin' ? `<button class="btn-small" onclick="makeAdmin('${doc.id}')">Make Admin</button>` : ''}
                    <button class="btn-small danger" onclick="deleteUserAccount('${doc.id}', '${user.email}')">Delete Account</button>
                </div>
            </div>
        `;
    }
    document.getElementById('usersList').innerHTML = html;
}

window.updateBalance = async (userId, newBalance) => {
    const bal = parseFloat(newBalance);
    if (isNaN(bal)) { showToast('Invalid number', true); return; }
    await db.collection('users').doc(userId).update({ balance: bal });
    showToast('Balance updated');
    loadAllUsers();
    loadStats();
};

window.addBalance = async (userId, amount) => {
    const add = parseFloat(amount);
    if (isNaN(add)) { showToast('Invalid amount', true); return; }
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        t.update(userRef, { balance: (userSnap.data().balance || 0) + add });
    });
    showToast(`Added K${add}`);
    loadAllUsers();
    loadStats();
};

window.subtractBalance = async (userId, amount) => {
    const sub = parseFloat(amount);
    if (isNaN(sub)) { showToast('Invalid amount', true); return; }
    const userRef = db.collection('users').doc(userId);
    await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        const newBal = (userSnap.data().balance || 0) - sub;
        if (newBal < 0) throw new Error('Balance cannot be negative');
        t.update(userRef, { balance: newBal });
    });
    showToast(`Subtracted K${sub}`);
    loadAllUsers();
    loadStats();
};

window.toggleBlockUser = async (userId, currentlyBlocked) => {
    await db.collection('users').doc(userId).update({ isBlocked: !currentlyBlocked });
    showToast(`User ${!currentlyBlocked ? 'blocked' : 'unblocked'}`);
    loadAllUsers();
};

window.makeAdmin = async (userId) => {
    await db.collection('users').doc(userId).update({ role: 'admin' });
    showToast('User is now admin');
    loadAllUsers();
};

window.resetUserPassword = async (email) => {
    try {
        await auth.sendPasswordResetEmail(email);
        showToast(`Password reset email sent to ${email}`);
    } catch (err) {
        showToast(err.message, true);
    }
};

window.deleteUserAccount = async (userId, email) => {
    if (!confirm(`⚠️ Permanently delete user ${email}? This will delete all user data (deposits, withdrawals, investments, loans, transactions). This action cannot be undone.`)) return;
    // Delete user subcollections
    const collections = ['deposits', 'withdrawals', 'investments', 'loans', 'transactions'];
    for (const coll of collections) {
        const snapshot = await db.collection(coll).where('userId', '==', userId).get();
        snapshot.forEach(doc => doc.ref.delete());
    }
    // Delete user document
    await db.collection('users').doc(userId).delete();
    // Firebase Auth user must be deleted manually (admin SDK required)
    showToast(`User data deleted. Firebase Auth user must be deleted manually from Firebase Console.`, true);
    loadAllUsers();
    loadStats();
};

// ============= TREASURE CODES =============
async function loadTreasureCodes() {
    const snapshot = await db.collection('treasureCodes').orderBy('createdAt', 'desc').limit(20).get();
    let html = 'ables\n<td><th>Code</th><th>Amount</th><th>Used</th><th>Used By</th><th>Actions</th></tr>';
    snapshot.forEach(doc => {
        const data = doc.data();
        html += `<tr>
            <td>${data.code}</td>
            <td>K${data.amount}</td>
            <td>${data.used ? 'Yes' : 'No'}</td>
            <td>${data.usedBy ? data.usedBy.slice(0,8)+'...' : '-'}</td>
            <td><button class="btn-small danger" onclick="deleteTreasureCode('${doc.id}')">Delete</button></td>
        </tr>`;
    });
    html += '</table>';
    document.getElementById('treasureCodesList').innerHTML = html;
}

document.getElementById('createCodeBtn')?.addEventListener('click', async () => {
    const code = document.getElementById('newCode').value.trim().toUpperCase();
    const amount = parseFloat(document.getElementById('codeAmount').value);
    if (!code || code.length !== 7 || !/^[A-Z0-9]{7}$/.test(code)) {
        showToast('Code must be 7 uppercase letters/numbers', true);
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        showToast('Valid amount required', true);
        return;
    }
    const existing = await db.collection('treasureCodes').where('code', '==', code).get();
    if (!existing.empty) {
        showToast('Code already exists', true);
        return;
    }
    await db.collection('treasureCodes').add({
        code, amount, used: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Treasure code created!');
    document.getElementById('newCode').value = '';
    document.getElementById('codeAmount').value = '';
    loadTreasureCodes();
});

window.deleteTreasureCode = async (id) => {
    await db.collection('treasureCodes').doc(id).delete();
    showToast('Code deleted');
    loadTreasureCodes();
};

// ============= MK VIP PLANS =============
async function loadMkVipPlans() {
    const snapshot = await db.collection('mkvipPlans').orderBy('createdAt', 'desc').get();
    let html = '';
    snapshot.forEach(doc => {
        const plan = doc.data();
        html += `
            <div class="plan-row">
                <div><strong>${plan.name}</strong><br>Min: K${plan.minAmount} | Max: K${plan.maxAmount}<br>Daily: ${plan.dailyReturn}% for ${plan.days} days</div>
                <div><button class="btn-small danger" onclick="deletePlan('mkvipPlans', '${doc.id}')">Delete</button></div>
            </div>
        `;
    });
    document.getElementById('mkvipPlansList').innerHTML = html || '<p>No plans created yet.</p>';
}

document.getElementById('createMkVipBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('mkvipName').value.trim();
    const minAmount = parseFloat(document.getElementById('mkvipMin').value);
    const maxAmount = parseFloat(document.getElementById('mkvipMax').value);
    const dailyReturn = parseFloat(document.getElementById('mkvipDaily').value);
    const days = parseInt(document.getElementById('mkvipDays').value);
    if (!name || isNaN(minAmount) || isNaN(maxAmount) || isNaN(dailyReturn) || isNaN(days)) {
        showToast('All fields are required', true);
        return;
    }
    await db.collection('mkvipPlans').add({
        name, minAmount, maxAmount, dailyReturn, days,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Plan created');
    document.getElementById('mkvipName').value = '';
    document.getElementById('mkvipMin').value = '';
    document.getElementById('mkvipMax').value = '';
    document.getElementById('mkvipDaily').value = '';
    document.getElementById('mkvipDays').value = '';
    loadMkVipPlans();
});

// ============= J PRODUCT PLANS =============
async function loadJProductPlans() {
    const snapshot = await db.collection('jproductPlans').orderBy('createdAt', 'desc').get();
    let html = '';
    snapshot.forEach(doc => {
        const plan = doc.data();
        html += `
            <div class="plan-row">
                <div><strong>${plan.name}</strong><br>Min: K${plan.minAmount} | Max: K${plan.maxAmount}<br>Daily: ${plan.dailyReturn}% for ${plan.days} days</div>
                <div><button class="btn-small danger" onclick="deletePlan('jproductPlans', '${doc.id}')">Delete</button></div>
            </div>
        `;
    });
    document.getElementById('jproductPlansList').innerHTML = html || '<p>No plans created yet.</p>';
}

document.getElementById('createJProductBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('jproductName').value.trim();
    const minAmount = parseFloat(document.getElementById('jproductMin').value);
    const maxAmount = parseFloat(document.getElementById('jproductMax').value);
    const dailyReturn = parseFloat(document.getElementById('jproductDaily').value);
    const days = parseInt(document.getElementById('jproductDays').value);
    if (!name || isNaN(minAmount) || isNaN(maxAmount) || isNaN(dailyReturn) || isNaN(days)) {
        showToast('All fields are required', true);
        return;
    }
    await db.collection('jproductPlans').add({
        name, minAmount, maxAmount, dailyReturn, days,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('Plan created');
    document.getElementById('jproductName').value = '';
    document.getElementById('jproductMin').value = '';
    document.getElementById('jproductMax').value = '';
    document.getElementById('jproductDaily').value = '';
    document.getElementById('jproductDays').value = '';
    loadJProductPlans();
});

window.deletePlan = async (collection, docId) => {
    await db.collection(collection).doc(docId).delete();
    showToast('Plan deleted');
    if (collection === 'mkvipPlans') loadMkVipPlans();
    else if (collection === 'jproductPlans') loadJProductPlans();
};

// ============= NEWS MANAGEMENT =============
async function loadNews() {
    const snapshot = await db.collection('news').orderBy('createdAt', 'desc').get();
    let html = '';
    snapshot.forEach(doc => {
        const news = doc.data();
        html += `
            <div class="news-row">
                <div><strong>${news.title}</strong><br><small>${news.createdAt?.toDate().toLocaleString() || 'Just now'}</small><br>${news.content}</div>
                <div><button class="btn-small danger" onclick="deleteNews('${doc.id}')">Delete</button></div>
            </div>
        `;
    });
    document.getElementById('newsList').innerHTML = html || '<p>No news posts yet.</p>';
}

document.getElementById('postNewsBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    if (!title || !content) {
        showToast('Title and content required', true);
        return;
    }
    await db.collection('news').add({
        title, content,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('News posted');
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    loadNews();
});

window.deleteNews = async (id) => {
    await db.collection('news').doc(id).delete();
    showToast('News deleted');
    loadNews();
};

// ============= SETTINGS =============
async function loadSettings() {
    const settingsRef = db.collection('systemSettings').doc('publicSettings');
    const doc = await settingsRef.get();
    let settings = doc.exists ? doc.data() : { depositsEnable: true, withdrawalsEnable: true, loansEnable: true, registrationOpen: true, maintenanceMode: false };
    const container = document.getElementById('settingsToggles');
    if (!container) return;
    container.innerHTML = `
        <div><label>Enable Deposits</label> <div class="toggle-switch ${settings.depositsEnable ? 'active' : ''}" data-field="depositsEnable"></div></div>
        <div><label>Enable Withdrawals</label> <div class="toggle-switch ${settings.withdrawalsEnable ? 'active' : ''}" data-field="withdrawalsEnable"></div></div>
        <div><label>Enable Loans</label> <div class="toggle-switch ${settings.loansEnable ? 'active' : ''}" data-field="loansEnable"></div></div>
        <div><label>Registration Open</label> <div class="toggle-switch ${settings.registrationOpen ? 'active' : ''}" data-field="registrationOpen"></div></div>
        <div><label>Maintenance Mode</label> <div class="toggle-switch ${settings.maintenanceMode ? 'active' : ''}" data-field="maintenanceMode"></div></div>
    `;
    document.querySelectorAll('.toggle-switch').forEach(toggle => {
        toggle.addEventListener('click', async () => {
            const field = toggle.dataset.field;
            const newValue = !toggle.classList.contains('active');
            const update = {}; update[field] = newValue;
            await settingsRef.set(update, { merge: true });
            toggle.classList.toggle('active', newValue);
            showToast(`${field} updated`);
        });
    });
}

async function loadInvestmentPlans() {
    const doc = await db.collection('systemSettings').doc('investmentPlans').get();
    const plans = doc.exists ? doc.data().plans : [{ name: "Starter", minAmount: 100, maxAmount: 500, dailyReturn: 2, days: 30 }];
    const textarea = document.getElementById('investmentPlansJson');
    if (textarea) textarea.value = JSON.stringify(plans, null, 2);
}

document.getElementById('savePlansBtn')?.addEventListener('click', async () => {
    try {
        const plans = JSON.parse(document.getElementById('investmentPlansJson').value);
        await db.collection('systemSettings').doc('investmentPlans').set({ plans });
        showToast('Investment plans saved');
    } catch(e) {
        showToast('Invalid JSON', true);
    }
});

// ============= INITIAL LOAD (called from admin-dashboard.html) =============
async function initAdminPanel() {
    await loadStats();
    await loadPendingDeposits();
    await loadCompletedDeposits();
    await loadPendingWithdrawals();
    await loadActiveLoans();
    await loadAllUsers();
    await loadTreasureCodes();
    await loadSettings();
    await loadInvestmentPlans();
    await loadMkVipPlans();
    await loadJProductPlans();
    await loadNews();
}