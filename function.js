const initialItems = [];

let currentActiveUser = ""; 

const searchInput = document.getElementById('searchInput');
const catSelect = document.getElementById('catSelect');
const locationInput = document.getElementById('locationInput');
const sortSelect = document.getElementById('sortSelect');
const statusButtons = document.querySelectorAll('#statusTabs .tab');

let currentStatusFilter = 'all';

if (statusButtons.length > 0) {
    statusButtons.forEach(button => {
        button.addEventListener('click', () => {
            statusButtons.forEach(t => t.classList.remove('active'));
            button.classList.add('active');
            currentStatusFilter = button.getAttribute('data-status').toLowerCase();
            filterAndDisplayItems();
        });
    });
}

if (searchInput) searchInput.addEventListener('input', filterAndDisplayItems);
if (catSelect) catSelect.addEventListener('change', filterAndDisplayItems);
if (locationInput) locationInput.addEventListener('input', filterAndDisplayItems);
if (sortSelect) sortSelect.addEventListener('change', filterAndDisplayItems);

function formatItemDate(item) {
    const raw = item.date || item.time || '';
    // Kalau kosong, "Just now", atau sebarang nilai lama yang tak valid — guna timestamp
    if (!raw || raw.toLowerCase() === 'just now' || raw.toLowerCase() === 'today') {
        const ts = item.timestamp;
        if (ts) return new Date(ts).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
        return new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return raw;
}

function filterAndDisplayItems() {
    const itemGrid = document.getElementById('item-grid');
    if (!itemGrid) return;
    
    // Read from unified 'reports' key first, fall back to 'reportedItems' for backwards compat
    const fromReports = JSON.parse(localStorage.getItem('reports')) || [];
    const fromReportedItems = JSON.parse(localStorage.getItem('reportedItems')) || [];
    const claimedInitialItems = JSON.parse(localStorage.getItem('claimedInitialItems')) || [];

    // Merge & deduplicate by timestamp
    const mergedMap = {};
    fromReports.forEach((item, idx) => {
        const key = item.timestamp || item.id || idx;
        mergedMap[key] = {
            ...item,
            name: item.name || item.title,
            type: item.status || item.type || 'lost',
            user: item.user || item.reporter || item.reporterName || 'Anonymous',
            avatar: item.avatar || (item.user || 'A').substring(0,2).toUpperCase(),
            avatarColor: item.avatarColor || '#475569',
            timestamp: item.timestamp || item.id || (1718000000900 + idx)
        };
    });
    fromReportedItems.forEach((item, idx) => {
        const key = item.timestamp || idx;
        if (!mergedMap[key]) {
            mergedMap[key] = {
                ...item,
                user: item.user || 'Anonymous',
                avatar: item.avatar || 'AN',
                avatarColor: item.avatarColor || '#475569',
                timestamp: item.timestamp || (1718000000900 + idx)
            };
        }
    });

    let localInitialItems = initialItems.map(item => {
        if (claimedInitialItems.includes(item.timestamp)) {
            return { ...item, type: 'claimed' };
        }
        return item;
    });

    let allItems = [...Object.values(mergedMap), ...localInitialItems];

    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const selectedCategory = catSelect ? catSelect.value : "";
    const locationQuery = locationInput ? locationInput.value.toLowerCase().trim() : "";

    let filteredItems = allItems.filter(item => {
        const matchesSearch = searchInput ? item.name.toLowerCase().includes(searchQuery) : true;
        const matchesCategory = catSelect ? (selectedCategory === "" || item.category === selectedCategory) : true;
        const matchesLocation = locationInput ? item.location.toLowerCase().includes(locationQuery) : true;
        const matchesStatus = currentStatusFilter === 'all' || item.type.toLowerCase() === currentStatusFilter;
        return matchesSearch && matchesCategory && matchesLocation && matchesStatus;
    });

    if (sortSelect) {
        if (sortSelect.value === 'newest') filteredItems.sort((a, b) => b.timestamp - a.timestamp);
        else if (sortSelect.value === 'oldest') filteredItems.sort((a, b) => a.timestamp - b.timestamp);
        else if (sortSelect.value === 'az') filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    }

    itemGrid.innerHTML = '';

    if (filteredItems.length === 0) {
        itemGrid.innerHTML = `<div class="no-items-placeholder" style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #64748b;"><h3>No matching items found</h3></div>`;
        return;
    }

    filteredItems.forEach(item => {
        const currentType = item.type.toLowerCase();
        const badgeClass = currentType === 'lost' ? 'status-lost' : (currentType === 'found' ? 'status-found' : 'status-claimed');
        const badgeLabel = currentType.charAt(0).toUpperCase() + currentType.slice(1);
        const displayImg = item.imgSrc || '';

        let actionButtonHTML = '';
        if (currentType === 'claimed') {
            actionButtonHTML = `<span style="color: #475569; font-size: 0.85rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; background: #e2e8f0; padding: 6px 12px; border-radius: 20px;">✓ Claimed</span>`;
        } else {
            actionButtonHTML = `<button class="btn-contact" style="cursor:pointer; border:none;" onclick="triggerNewMessage('${item.user.replace(/'/g, "\\'")}', '${item.name.replace(/'/g, "\\'")}', ${item.timestamp}, '${displayImg}', '${currentType}')">Contact</button>`;
        }

        // Store item data for modal access
        const itemDataAttr = encodeURIComponent(JSON.stringify({
            name: item.name,
            category: item.category,
            location: item.location,
            date: formatItemDate(item),
            user: item.user,
            imgSrc: displayImg,
            type: currentType,
            description: item.description || item.desc || '',
            timestamp: item.timestamp
        }));

        const cardHTML = `
            <div class="item-card" onclick="openReportDetail(this)" data-item="${itemDataAttr}" style="cursor:pointer;">
                <div class="card-image-area" style="position: relative;">
                    <span class="status-badge ${badgeClass}">${badgeLabel}</span>
                    ${displayImg ? `<img src="${displayImg}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: cover; display: block;">` : `<span class="material-symbols-outlined" style="font-size: 48px; color: #94A3B8;">image</span>`}
                </div>
                <div class="card-content">
                    <div class="category-label">${item.category}</div>
                    <h3 class="item-title">${item.name}</h3>
                    <div class="item-meta"><span class="meta-info">📍 ${item.location}</span></div>
                    <div class="item-meta"><span class="meta-info">🗓️ ${formatItemDate(item)}</span></div>
                    <div class="card-footer">
                        <div class="user-info">
                            <div class="user-avatar" style="background: ${item.avatarColor || '#334155'}">${item.avatar || 'U'}</div>
                            ${item.user}
                        </div>
                        <div onclick="event.stopPropagation()">
                            ${actionButtonHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
        itemGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

window.addEventListener('DOMContentLoaded', filterAndDisplayItems);

function toggleChatWidget() {
    // Redirect to login if user is not logged in
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        localStorage.setItem('redirectAfterLogin', 'browse.html');
        window.location.href = 'login.html';
        return;
    }

    const popup = document.getElementById('chatPopup');
    if (popup) popup.classList.toggle('active');
    
    if (popup && !popup.classList.contains('active')) {
        closeConversationScreen();
    } else {
        const badge = document.getElementById('chatBadge');
        if (badge) badge.style.display = 'none';
        localStorage.setItem('chatUnread', 'false');
        loadChatMessages();
    }
}

function triggerNewMessage(ownerName, itemName, itemTimestamp, imgSrc, itemType) {
    // Check if user is logged in before allowing contact
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (isLoggedIn !== 'true') {
        localStorage.setItem('redirectAfterLogin', 'browse.html');
        window.location.href = 'login.html';
        return;
    }

    // Prevent user from contacting themselves
    const currentUser = localStorage.getItem('userName');
    if (currentUser && currentUser === ownerName) {
        alert('You cannot contact yourself on your own item.');
        return;
    }

    let accountChats = JSON.parse(localStorage.getItem('chatMessagesByAccount')) || {};

    if (!accountChats[ownerName]) {
        accountChats[ownerName] = {
            name: ownerName,
            lastUpdated: Date.now(),
            messages: []
        };
    }

    const isItemInquiryExist = accountChats[ownerName].messages.some(m => m.itemReference === itemTimestamp || (m.itemNameRef && m.itemNameRef === itemName));

    if (!isItemInquiryExist) {
        accountChats[ownerName].messages.push({
            type: 'item-card', 
            itemReference: itemTimestamp,
            itemNameRef: itemName,
            itemImgSrc: imgSrc,
            itemStatusType: itemType
        });
    }

    accountChats[ownerName].lastUpdated = Date.now();
    localStorage.setItem('chatMessagesByAccount', JSON.stringify(accountChats));
    localStorage.setItem('chatUnread', 'true');

    // Pembetulan: Tetapkan pengguna aktif dan buka skrin perbualan dengan betul
    openConversationScreen(ownerName);

    const popup = document.getElementById('chatPopup');
    if (popup && !popup.classList.contains('active')) popup.classList.add('active');
}

function openConversationScreen(ownerName) {
    currentActiveUser = ownerName;
    const activeUserEl = document.getElementById('chatActiveUser');
    if (activeUserEl) activeUserEl.innerText = ownerName;

    renderConversationMessages();
    const convView = document.getElementById('chatConversationView');
    if (convView) convView.classList.add('active');
}

function renderConversationMessages() {
    const conversationBody = document.getElementById('chatConversationBody');
    if (!conversationBody || !currentActiveUser) return;

    conversationBody.innerHTML = `
        <div style="text-align: center; font-size: 0.72rem; color: #64748b; margin-bottom: 12px;">Safety Tips: Meet up in public campus areas.</div>
    `;

    let accountChats = JSON.parse(localStorage.getItem('chatMessagesByAccount')) || {};
    const currentChatData = accountChats[currentActiveUser];

    const storedItems = JSON.parse(localStorage.getItem('reportedItems')) || [];
    const reportsItems = JSON.parse(localStorage.getItem('reports')) || [];
    const claimedInitialItems = JSON.parse(localStorage.getItem('claimedInitialItems')) || [];

    if (currentChatData && currentChatData.messages) {
        currentChatData.messages.forEach((msg, index) => {
            if (msg.type === 'item-card') {
                const matchInStored = storedItems.find(it => it.name === msg.itemNameRef || it.timestamp == msg.itemReference);
                const matchInReports = reportsItems.find(it => it.name === msg.itemNameRef || it.title === msg.itemNameRef || it.timestamp == msg.itemReference);
                const matchInInitial = initialItems.find(it => it.name === msg.itemNameRef);
                const isInitialClaimed = matchInInitial ? claimedInitialItems.includes(matchInInitial.timestamp) : false;
                const isItemClaimed = 
                    (matchInStored && matchInStored.type && matchInStored.type.toLowerCase() === 'claimed') || 
                    (matchInReports && matchInReports.status && matchInReports.status.toLowerCase() === 'claimed') ||
                    (matchInReports && matchInReports.type && matchInReports.type.toLowerCase() === 'claimed') ||
                    isInitialClaimed;

                let btnHTML = '';
                if (isItemClaimed) {
                    btnHTML = `<button class="btn-chat-claimed is-claimed" style="background:#10b981; color:#fff; border:none; border-radius:4px; padding:4px 8px; font-size:11px; display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-outlined" style="font-size:12px;">check_circle</span>Claimed</button>`;
                } else {
                    btnHTML = `<button class="btn-chat-claimed" onclick="markSpecificItemAsClaimed('${msg.itemNameRef.replace(/'/g, "\\'")}', ${msg.itemReference})" style="background:#e2e8f0; color:#475569; border:none; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer; display:inline-flex; align-items:center; gap:2px;"><span class="material-symbols-outlined" style="font-size:12px;">check_circle</span>Mark as Claimed</button>`;
                }

                let imgElement = `<span class="material-symbols-outlined" style="color:#94a3b8;">image</span>`;
                if (msg.itemImgSrc && msg.itemImgSrc !== 'undefined' && msg.itemImgSrc !== '') {
                    imgElement = `<img src="${msg.itemImgSrc}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">`;
                }

                const cardBlockHTML = `
                    <div class="chat-product-card" style="margin-bottom: 12px; background: #1e293b; padding: 10px; border-radius: 8px; display: flex; gap: 10px; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="chat-product-img" style="width: 45px; height: 45px; background: #0f172a; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
                            ${imgElement}
                        </div>
                        <div class="chat-product-details" style="flex-grow: 1;">
                            <p class="chat-product-title" style="font-size: 0.85rem; color: #fff; font-weight: 500; margin-bottom: 4px;">${msg.itemNameRef}</p>
                            ${btnHTML}
                        </div>
                    </div>
                `;
                conversationBody.insertAdjacentHTML('beforeend', cardBlockHTML);
            } 
            else {
                const bubbleHTML = `<div class="chat-bubble ${msg.type}">${msg.text}<span style="display:block; font-size:10px; opacity:0.5; text-align:right; margin-top:4px;">${msg.time || ''}</span></div>`;
                conversationBody.insertAdjacentHTML('beforeend', bubbleHTML);
            }
        });
    }

    conversationBody.scrollTop = conversationBody.scrollHeight;
}

function closeConversationScreen() {
    const convView = document.getElementById('chatConversationView');
    if (convView) convView.classList.remove('active');
    currentActiveUser = "";
    loadChatMessages();
}

function markSpecificItemAsClaimed(itemName, itemTimestamp) {
    let storedItems = JSON.parse(localStorage.getItem('reportedItems')) || [];
    let claimedInitialItems = JSON.parse(localStorage.getItem('claimedInitialItems')) || [];

    let found = false;
    storedItems.forEach((item, idx) => {
        if (item.name === itemName || item.timestamp == itemTimestamp) {
            storedItems[idx].type = 'claimed';
            storedItems[idx].status = 'claimed';
            found = true;
        }
    });

    if (!found) {
        const matchInitial = initialItems.find(it => it.name === itemName || it.timestamp == itemTimestamp);
        if (matchInitial && !claimedInitialItems.includes(matchInitial.timestamp)) {
            claimedInitialItems.push(matchInitial.timestamp);
        }
    }

    // Sync reportedItems
    localStorage.setItem('reportedItems', JSON.stringify(storedItems));
    localStorage.setItem('claimedInitialItems', JSON.stringify(claimedInitialItems));

    // Sync 'reports' key supaya admin.html & browse.html reflect perubahan
    let reports = JSON.parse(localStorage.getItem('reports')) || [];
    let reportFound = false;
    reports.forEach((item, idx) => {
        if (item.name === itemName || item.title === itemName || item.timestamp == itemTimestamp) {
            reports[idx].type = 'claimed';
            reports[idx].status = 'claimed';
            reportFound = true;
        }
    });
    if (!reportFound) {
        const matchStored = storedItems.find(it => it.name === itemName || it.timestamp == itemTimestamp);
        if (matchStored) {
            reports.unshift({ ...matchStored, type: 'claimed', status: 'claimed' });
        }
    }
    localStorage.setItem('reports', JSON.stringify(reports));

    renderConversationMessages();
    filterAndDisplayItems();
}

function loadChatMessages() {
    const placeholder = document.getElementById('noMessagePlaceholder');
    const chatList = document.getElementById('chatList');
    const badge = document.getElementById('chatBadge');
    const popup = document.getElementById('chatPopup');

    const accountChats = JSON.parse(localStorage.getItem('chatMessagesByAccount')) || {};
    const sortedAccounts = Object.values(accountChats).sort((a, b) => b.lastUpdated - a.lastUpdated);
    const isUnread = localStorage.getItem('chatUnread') === 'true';

    // 1. DAPATKAN NAMA PENGGUNA YANG SEDANG LOG MASUK SEKARANG
    const currentUser = localStorage.getItem('userName') || "Anonymous";

    // 2. TAPIS KELUAR: Jangan paparkan akaun diri sendiri di dalam senarai perbualan
    const filteredAccounts = sortedAccounts.filter(acc => acc.name !== currentUser);

    // Gunakan filteredAccounts selepas ini (bukan sortedAccounts lagi)
    if (filteredAccounts.length === 0) {
        if (placeholder) placeholder.style.display = 'flex';
        if (chatList) chatList.style.display = 'none';
        if (badge) badge.style.display = 'none';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';
    if (chatList) {
        chatList.style.display = 'flex';
        chatList.innerHTML = '';
        
        filteredAccounts.forEach(acc => {
            const lastMsg = acc.messages[acc.messages.length - 1];
            let previewText = "No messages yet";
            
            if (lastMsg) {
                previewText = lastMsg.type === 'item-card' ? `Sent an item reference: ${lastMsg.itemNameRef}` : lastMsg.text;
            }
            
            const truncatedPreview = previewText.length > 40 ? previewText.substring(0, 38) + "..." : previewText;

            const chatHTML = `
                <div class="chat-item" onclick="openConversationScreen('${acc.name.replace(/'/g, "\\'")}')">
                    <div class="chat-avatar"><span class="material-symbols-outlined">person</span></div>
                    <div class="chat-info">
                        <div class="chat-meta">
                            <span class="chat-name">${acc.name}</span>
                            <span class="chat-time">${lastMsg && lastMsg.time ? lastMsg.time : ''}</span>
                        </div>
                        <div class="chat-preview">${truncatedPreview}</div>
                    </div>
                </div>
            `;
            chatList.insertAdjacentHTML('beforeend', chatHTML);
        });
    }

    if (badge) badge.style.display = (isUnread && (!popup || !popup.classList.contains('active'))) ? 'block' : 'none';
}

function sendNewChatMessage() {
    const input = document.getElementById('chatInputField');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !currentActiveUser) return;

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let accountChats = JSON.parse(localStorage.getItem('chatMessagesByAccount')) || {};
    
    if (!accountChats[currentActiveUser]) {
        accountChats[currentActiveUser] = {
            name: currentActiveUser,
            lastUpdated: Date.now(),
            messages: []
        };
    }

    accountChats[currentActiveUser].messages.push({
        text: text,
        type: 'outgoing',
        time: timeString
    });

    accountChats[currentActiveUser].lastUpdated = Date.now();
    localStorage.setItem('chatMessagesByAccount', JSON.stringify(accountChats));

    input.value = '';
    
    // Refresh kedua-dua paparan perbualan DAN senarai sembang utama
    renderConversationMessages();
    loadChatMessages(); 
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') sendNewChatMessage();
}

window.addEventListener('DOMContentLoaded', loadChatMessages);

function setType(type) {
    const lostBtn = document.getElementById('lostBtn');
    const foundBtn = document.getElementById('foundBtn');
    if (!lostBtn || !foundBtn) return;

    if (type === 'lost') {
        lostBtn.classList.add('active-lost');
        foundBtn.classList.remove('active-found');
    } else {
        foundBtn.classList.add('active-found');
        lostBtn.classList.remove('active-lost');
    }
}

// Image Upload Control Elements
const fileInput = document.getElementById('fileInput');
const uploadDefault = document.getElementById('uploadDefault');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const btnRemoveImage = document.getElementById('btnRemoveImage');

if (fileInput) {
    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Please select an image file format only (JPEG/PNG).');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                if (imagePreview) imagePreview.src = e.target.result;
                if (uploadDefault) uploadDefault.style.display = 'none';
                if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

if (btnRemoveImage) {
    btnRemoveImage.addEventListener('click', function(e) {
        e.stopPropagation();
        if (fileInput) fileInput.value = '';
        if (imagePreview) imagePreview.src = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        if (uploadDefault) uploadDefault.style.display = 'block';
    });
}

const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.onsubmit = function(e) {
        e.preventDefault();
        
        const reportTypeInput = document.getElementById('reportType');
        const reportType = reportTypeInput ? reportTypeInput.value : 'lost';
        const itemName = this.querySelector('input[placeholder*="e.g. AirPods"]').value;
        const categorySelect = this.querySelector('select');
        const categoryValue = categorySelect.value;
        const categoryText = categorySelect.options[categorySelect.selectedIndex].text;
        const location = this.querySelector('input[placeholder*="Library PTTA"]').value;
        const description = this.querySelector('textarea').value;

        const iconMap = {
            'electronics': 'https://img.icons8.com/fluency/80/airpods-pro.png',
            'keys': 'https://img.icons8.com/fluency/80/identification-documents.png',
            'bags': 'https://img.icons8.com/fluency/80/wallet.png',
            'stationery': 'https://img.icons8.com/fluency/80/pencil.png',
            'clothings': 'https://img.icons8.com/fluency/80/t-shirt.png',
            'documents': 'https://img.icons8.com/fluency/80/file.png',
            'others': 'https://img.icons8.com/fluency/80/help.png'
        };
        
        let itemImage = iconMap[categoryValue] || 'https://img.icons8.com/fluency/80/help.png';
        if (imagePreview && imagePreview.src && imagePreview.src.startsWith('data:image')) {
            itemImage = imagePreview.src;
        }

        const loggedInName = localStorage.getItem("userName") || "Anonymous";
        const avatarInitials = loggedInName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

        const newItem = {
            type: reportType,
            status: reportType,
            name: itemName,
            title: itemName,
            category: categoryText,
            location: location,
            description: description,
            time: new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            date: new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }),
            user: loggedInName,
            reporter: loggedInName,
            reporterName: loggedInName,
            avatar: avatarInitials,
            avatarColor: '#4F46E5', 
            imgSrc: itemImage,
            timestamp: Date.now()
        };

        // Save to unified 'reports' key (read by admin.html)
        let reports = JSON.parse(localStorage.getItem('reports')) || [];
        reports.unshift(newItem);
        localStorage.setItem('reports', JSON.stringify(reports));

        // Also save to 'reportedItems' for backwards compat with browse.html
        let reportedItems = JSON.parse(localStorage.getItem('reportedItems')) || [];
        reportedItems.unshift(newItem);
        localStorage.setItem('reportedItems', JSON.stringify(reportedItems));

        alert("Your report has been successfully submitted!");
        window.location.href = 'browse.html';
    };
}

function toggleReportType(type) {
    const lostBtn = document.getElementById('lostBtn');
    const foundBtn = document.getElementById('foundBtn');
    const reportTypeInput = document.getElementById('reportType');

    if (!lostBtn || !foundBtn) return;

    if (type === 'lost') {
        lostBtn.classList.add('active-lost');
        foundBtn.classList.remove('active-found');
        if (reportTypeInput) reportTypeInput.value = 'lost';
    } else {
        foundBtn.classList.add('active-found');
        lostBtn.classList.remove('active-lost');
        if (reportTypeInput) reportTypeInput.value = 'found';
    }
}

document.addEventListener('click', function(event) {
    const popup = document.getElementById('chatPopup');
    const chatBadge = document.getElementById('chatBadge');
    
    if (!popup || !popup.classList.contains('active')) return;

    const chatToggleBtn = document.querySelector('.chat-toggle-btn') || document.getElementById('chatBadge')?.parentElement;
    
    const isContactBtn = event.target.closest('.btn-contact');

    if (!popup.contains(event.target) && (!chatToggleBtn || !chatToggleBtn.contains(event.target)) && !isContactBtn) {
        
        popup.classList.remove('active');
        
        closeConversationScreen();
    }
});
// ============================================================
// REPORT DETAIL MODAL
// ============================================================

function ensureReportModals() {
    if (document.getElementById('report-detail-overlay')) return;

    const modalHTML = `
    <style>
        #report-detail-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15,23,42,0.6); backdrop-filter: blur(6px);
            display: flex; justify-content: center; align-items: center;
            z-index: 11000; opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease;
        }
        #report-detail-overlay.active { opacity: 1; pointer-events: auto; }
        #report-detail-card {
            background: #ffffff; border: 1px solid rgba(0,0,0,0.06);
            border-radius: 20px; width: 92%; max-width: 500px;
            max-height: 88vh; overflow-y: auto;
            box-shadow: 0 30px 60px rgba(0,0,0,0.15);
            transform: scale(0.92); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        #report-detail-overlay.active #report-detail-card { transform: scale(1); }
        .rd-img-wrap {
            width: 100%; height: 220px; overflow: hidden;
            border-radius: 20px 20px 0 0; background: #F8FAFC;
            display: flex; align-items: center; justify-content: center; position: relative;
        }
        .rd-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
        .rd-img-placeholder { font-size: 56px; color: #CBD5E1; }
        .rd-close-btn {
            position: absolute; top: 12px; right: 12px;
            background: rgba(255,255,255,0.9); border: none; border-radius: 50%;
            width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
            cursor: pointer; color: #0F172A; transition: background 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .rd-close-btn:hover { background: #ffffff; }
        .rd-body { padding: 22px 24px 24px; }
        .rd-badge {
            display: inline-block; font-size: 0.75rem; font-weight: 700;
            padding: 4px 12px; border-radius: 6px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;
        }
        .rd-badge.lost   { background: #FEE2E2; color: #EF4444; }
        .rd-badge.found  { background: #DCFCE7; color: #22C55E; }
        .rd-badge.claimed{ background: #E2E8F0; color: #64748B; }
        .rd-title { color: #0F172A; font-size: 1.35rem; font-weight: 700; margin: 0 0 16px; font-family: Georgia, serif; }
        .rd-row { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 10px; color: #475569; font-size: 0.9rem; }
        .rd-row span.material-symbols-outlined { font-size: 18px; color: #14b8a6; flex-shrink: 0; margin-top: 1px; }
        .rd-desc-box {
            background: #F8FAFC; border: 1px solid #E2E8F0;
            border-radius: 8px; padding: 12px 14px; color: #475569;
            font-size: 0.88rem; line-height: 1.6; margin: 14px 0 20px;
        }
        .rd-desc-label { font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 6px; }
        .rd-footer-btns { display: flex; gap: 10px; }
        .rd-btn {
            flex: 1; padding: 11px; font-size: 0.9rem; font-weight: 600;
            border-radius: 9px; border: none; cursor: pointer; transition: all 0.2s;
            display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .rd-btn.edit  { background: #F1F5F9; border: 1px solid #E2E8F0; color: #0F172A; }
        .rd-btn.edit:hover  { background: #E2E8F0; }

        /* Edit contact popup */
        #edit-contact-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15,23,42,0.92); backdrop-filter: blur(6px);
            display: flex; justify-content: center; align-items: center;
            z-index: 12000; opacity: 0; pointer-events: none;
            transition: opacity 0.3s ease;
        }
        #edit-contact-overlay.active { opacity: 1; pointer-events: auto; }
        #edit-contact-card {
            background: #1e293b; border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px; width: 90%; max-width: 380px;
            padding: 30px; text-align: center;
            box-shadow: 0 25px 50px rgba(0,0,0,0.5);
            transform: scale(0.9); transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        #edit-contact-overlay.active #edit-contact-card { transform: scale(1); }
        .ec-icon-wrap {
            width: 60px; height: 60px; border-radius: 50%;
            background: rgba(20,184,166,0.1); border: 1px solid #14b8a6;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 16px; color: #14b8a6;
        }
        .ec-icon-wrap span { font-size: 30px !important; }
        .ec-title { color: #fff; font-size: 1.15rem; font-weight: 700; margin: 0 0 8px; }
        .ec-desc  { color: #94a3b8; font-size: 0.88rem; line-height: 1.55; margin: 0 0 22px; }
        .ec-btn-group { display: flex; gap: 10px; }
        .ec-btn {
            flex: 1; padding: 11px; font-size: 0.88rem; font-weight: 600;
            border-radius: 8px; cursor: pointer; border: none; transition: all 0.2s;
        }
        .ec-btn.primary { background: #14b8a6; color: #0f172a; }
        .ec-btn.primary:hover { background: #0d9488; }
        .ec-btn.secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; }
        .ec-btn.secondary:hover { background: rgba(255,255,255,0.1); }
    </style>

    <div id="report-detail-overlay" onclick="handleDetailOverlayClick(event)">
        <div id="report-detail-card">
            <div class="rd-img-wrap" id="rd-img-wrap">
                <button class="rd-close-btn" onclick="closeReportDetail()">
                    <span class="material-symbols-outlined" style="font-size:18px;">close</span>
                </button>
            </div>
            <div class="rd-body">
                <span class="rd-badge" id="rd-badge"></span>
                <h2 class="rd-title" id="rd-title"></h2>
                <div class="rd-row"><span class="material-symbols-outlined">category</span><span id="rd-category"></span></div>
                <div class="rd-row"><span class="material-symbols-outlined">location_on</span><span id="rd-location"></span></div>
                <div class="rd-row"><span class="material-symbols-outlined">calendar_month</span><span id="rd-date"></span></div>
                <div class="rd-row"><span class="material-symbols-outlined">person</span><span id="rd-reporter"></span></div>
                <div id="rd-desc-section">
                    <div class="rd-desc-label">Description</div>
                    <div class="rd-desc-box" id="rd-desc"></div>
                </div>
                <div class="rd-footer-btns">
                    <button class="rd-btn edit" onclick="openEditContactPopup()">
                        <span class="material-symbols-outlined" style="font-size:17px;">edit</span> Edit Report
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="edit-contact-overlay" onclick="handleEditOverlayClick(event)">
        <div id="edit-contact-card">
            <div class="ec-icon-wrap">
                <span class="material-symbols-outlined">support_agent</span>
            </div>
            <h3 class="ec-title">Want to Edit This Report?</h3>
            <p class="ec-desc">To make changes to a report, please contact our team. We'll help you update the details as soon as possible.</p>
            <div class="ec-btn-group">
                <button class="ec-btn secondary" onclick="closeEditContactPopup()">Cancel</button>
                <button class="ec-btn primary" onclick="goToContactUs()">
                    <span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle;">mail</span> Contact Us
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function openReportDetail(cardEl) {
    ensureReportModals();
    const data = JSON.parse(decodeURIComponent(cardEl.getAttribute('data-item')));

    // Populate image
    const imgWrap = document.getElementById('rd-img-wrap');
    // keep close button
    const closeBtn = imgWrap.querySelector('.rd-close-btn');
    imgWrap.innerHTML = '';
    imgWrap.appendChild(closeBtn);
    if (data.imgSrc) {
        const img = document.createElement('img');
        img.src = data.imgSrc;
        img.alt = data.name;
        imgWrap.insertBefore(img, closeBtn);
    } else {
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined rd-img-placeholder';
        icon.textContent = 'image';
        imgWrap.insertBefore(icon, closeBtn);
    }

    // Populate fields
    const badge = document.getElementById('rd-badge');
    badge.textContent = data.type.charAt(0).toUpperCase() + data.type.slice(1);
    badge.className = 'rd-badge ' + data.type;

    document.getElementById('rd-title').textContent    = data.name;
    document.getElementById('rd-category').textContent = data.category;
    document.getElementById('rd-location').textContent = data.location;
    document.getElementById('rd-date').textContent     = data.date;
    document.getElementById('rd-reporter').textContent = 'Reported by ' + data.user;

    const descSection = document.getElementById('rd-desc-section');
    const descBox     = document.getElementById('rd-desc');
    if (data.description && data.description.trim() !== '') {
        descBox.textContent = data.description;
        descSection.style.display = 'block';
    } else {
        descSection.style.display = 'none';
    }

    document.getElementById('report-detail-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeReportDetail() {
    const overlay = document.getElementById('report-detail-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

function handleDetailOverlayClick(e) {
    if (e.target === document.getElementById('report-detail-overlay')) closeReportDetail();
}

function openEditContactPopup() {
    document.getElementById('edit-contact-overlay').classList.add('active');
}

function closeEditContactPopup() {
    document.getElementById('edit-contact-overlay').classList.remove('active');
}

function handleEditOverlayClick(e) {
    if (e.target === document.getElementById('edit-contact-overlay')) closeEditContactPopup();
}

function goToContactUs() {
    closeEditContactPopup();
    closeReportDetail();
    window.location.href = 'about.html#team';
}