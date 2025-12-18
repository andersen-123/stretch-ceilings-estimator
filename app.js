// Основной модуль приложения - НАЧАЛО КЛАССА (только здесь!)
class EstimatorApp {
    constructor() {
        this.currentEstimate = null;
        this.currentPage = 'estimates';
        this.isSidebarOpen = false;
        this.estimates = [];
        this.templates = [];
        this.items = [];
        this.categories = [];
        this.companyData = null;
        this.appSettings = null;
        this.deferredPrompt = null;
        
        this.init();
    }

    async init() {
        console.log('Инициализация приложения...');
        await this.initDatabaseWithFileData();
        await this.loadData();
        this.bindEvents();
        this.checkInstallPrompt();
        this.hideSplashScreen();
        this.updateStorageInfo();
    }

    async initDatabaseWithFileData() {
        try {
            console.log('Инициализация базы данных...');
            
            const urls = [
                './data/default-templates.json',
                './data/default-items.json', 
                './data/company-info.json',
                './data/settings.json'
            ];
            
            const promises = urls.map(url => 
                fetch(url)
                    .then(r => r.ok ? r.json() : null)
                    .catch(() => null)
            );
            
            const [templatesData, itemsData, companyData, settingsData] = await Promise.all(promises);
            
            this.companyData = companyData || {
                company: {
                    name: 'PotolokForLife',
                    fullName: 'Натяжные потолки на всю жизнь',
                    address: 'Московская область, г. Пушкино',
                    phone: '8(977)531-10-99',
                    email: 'potolokforlife@yandex.ru'
                }
            };
            
            this.appSettings = settingsData || {
                app: { theme: 'light', currency: 'RUB' }
            };
            
            const db = await this.openDB();
            
            const [existingItems, existingTemplates] = await Promise.all([
                this.getAllFromStore(db, 'items'),
                this.getAllFromStore(db, 'templates')
            ]);
            
            if (existingItems.length === 0) {
                await this.createDefaultData(db);
            }
            
            if (existingTemplates.length === 0 && templatesData?.templates) {
                const transaction = db.transaction(['templates'], 'readwrite');
                const store = transaction.objectStore('templates');
                for (const template of templatesData.templates) {
                    await store.put({
                        ...template,
                        createdAt: new Date().toISOString()
                    });
                }
            }
            
            console.log('База данных инициализирована');
            
        } catch (error) {
            console.error('Ошибка инициализации БД:', error);
            const db = await this.openDB();
            await this.createDefaultData(db);
        }
    }

    async createDefaultData(db) {
        try {
            console.log('Создание дефолтных данных...');
            
            const defaultCategories = [
                { id: 'basic-materials', name: 'Основные материалы', sortOrder: 1, type: 'category' },
                { id: 'profiles', name: 'Профили и крепления', sortOrder: 2, type: 'category' },
                { id: 'electrical', name: 'Электромонтажные работы', sortOrder: 3, type: 'category' },
                { id: 'additional', name: 'Дополнительные работы', sortOrder: 4, type: 'category' },
                { id: 'cornices', name: 'Карнизы', sortOrder: 5, type: 'category' },
                { id: 'complex', name: 'Сложные работы', sortOrder: 6, type: 'category' }
            ];
            
            const defaultItems = [
                { id: 'item-1', name: 'Полотно MSD Premium белое матовое с установкой', unit: 'м²', price: 610, category: 'basic-materials', isActive: true },
                { id: 'item-2', name: 'Профиль стеновой/потолочный гарпунный с установкой', unit: 'м.п.', price: 310, category: 'profiles', isActive: true },
                { id: 'item-3', name: 'Вставка по периметру гарпунная', unit: 'м.п.', price: 220, category: 'profiles', isActive: true },
                { id: 'item-4', name: 'Монтаж закладных под световое оборудование, установка светильников', unit: 'шт.', price: 780, category: 'electrical', isActive: true },
                { id: 'item-5', name: 'Монтаж закладных под сдвоенное световое оборудование, установка светильников', unit: 'шт.', price: 1350, category: 'electrical', isActive: true },
                { id: 'item-6', name: 'Монтаж закладных под люстру', unit: 'шт.', price: 1100, category: 'electrical', isActive: true },
                { id: 'item-7', name: 'Монтаж закладной и установка вентилятора', unit: 'шт.', price: 1300, category: 'electrical', isActive: true },
                { id: 'item-8', name: 'Монтаж закладной под потолочный карниз', unit: 'м.п.', price: 650, category: 'cornices', isActive: true },
                { id: 'item-9', name: 'Установка потолочного карниза', unit: 'м.п.', price: 270, category: 'cornices', isActive: true },
                { id: 'item-10', name: 'Установка разделителей', unit: 'м.п.', price: 1700, category: 'additional', isActive: true }
            ];
            
            const itemsTransaction = db.transaction(['items'], 'readwrite');
            const itemsStore = itemsTransaction.objectStore('items');
            
            for (const category of defaultCategories) {
                await itemsStore.put({
                    ...category,
                    createdAt: new Date().toISOString()
                });
            }
            
            for (const item of defaultItems) {
                await itemsStore.put({
                    ...item,
                    createdAt: new Date().toISOString(),
                    type: 'item'
                });
            }
            
            const templatesTransaction = db.transaction(['templates'], 'readwrite');
            const templatesStore = templatesTransaction.objectStore('templates');
            
            const defaultTemplates = [
                {
                    id: 'template-garpun',
                    name: 'Гарпун (базовый)',
                    description: 'Базовая смета для гарпунной системы',
                    category: 'Потолки',
                    items: [
                        { name: 'Полотно MSD Premium белое матовое с установкой', unit: 'м²', price: 610 },
                        { name: 'Профиль стеновой/потолочный гарпунный с установкой', unit: 'м.п.', price: 310 },
                        { name: 'Вставка по периметру гарпунная', unit: 'м.п.', price: 220 }
                    ]
                }
            ];
            
            for (const template of defaultTemplates) {
                await templatesStore.put({
                    ...template,
                    createdAt: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('Ошибка создания дефолтных данных:', error);
        }
    }

    bindEvents() {
        // Навигация
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.dataset.page || e.target.closest('.menu-item').dataset.page;
                this.navigateTo(page);
            });
        });

        // Базовые обработчики
        document.getElementById('menu-toggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('close-menu')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        
        // Проверка обновлений Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker обновлен, перезагружаем...');
                window.location.reload();
            });
        }
    }

    toggleSidebar(force) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        if (force !== undefined) {
            this.isSidebarOpen = force;
        } else {
            this.isSidebarOpen = !this.isSidebarOpen;
        }
        
        sidebar.classList.toggle('active', this.isSidebarOpen);
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = isDark ? '☀️' : '🌙';
        }
    }

    async loadData() {
        try {
            const db = await this.openDB();
            
            this.estimates = await this.getAllFromStore(db, 'estimates') || [];
            this.templates = await this.getAllFromStore(db, 'templates') || [];
            
            const allItems = await this.getAllFromStore(db, 'items') || [];
            this.items = allItems.filter(item => item.type !== 'category');
            this.categories = allItems.filter(item => item.type === 'category');
            
            console.log('Данные загружены:', {
                estimates: this.estimates.length,
                templates: this.templates.length,
                items: this.items.length,
                categories: this.categories.length
            });
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    // ============ IndexedDB методы ============
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EstimatorDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('estimates')) {
                    const store = db.createObjectStore('estimates', { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('templates')) {
                    const store = db.createObjectStore('templates', { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('items')) {
                    const store = db.createObjectStore('items', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('isActive', 'isActive', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    getAllFromStore(db, storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });
    }

    // ============ Вспомогательные методы ============
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
            <span class="notification-text">${message}</span>
        `;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    hideSplashScreen() {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const app = document.getElementById('app');
            
            if (!splash || !app) return;
            
            splash.style.opacity = '0';
            splash.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                splash.style.display = 'none';
                app.style.display = 'flex';
                
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark') {
                    document.body.classList.add('dark-theme');
                    const themeBtn = document.getElementById('theme-toggle');
                    if (themeBtn) themeBtn.textContent = '☀️';
                }
                
                this.navigateTo('estimates');
                
            }, 500);
        }, 1000);
    }

    checkInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
            }
        });
    }

    async installApp() {
        if (!this.deferredPrompt) return;
        
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            this.showNotification('Приложение установлено!', 'success');
            document.getElementById('install-btn').style.display = 'none';
        }
        
        this.deferredPrompt = null;
    }

    updateStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate()
                .then(estimate => {
                    const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
                    const totalMB = (estimate.quota / 1024 / 1024).toFixed(2);
                    const percentage = (estimate.usage / estimate.quota * 100).toFixed(0);
                    
                    const storageUsed = document.getElementById('storage-used');
                    const storageTotal = document.getElementById('storage-total');
                    const storageFill = document.getElementById('storage-fill');
                    
                    if (storageUsed) storageUsed.textContent = usedMB;
                    if (storageTotal) storageTotal.textContent = totalMB;
                    if (storageFill) storageFill.style.width = `${percentage}%`;
                });
        }
    }

    updateOnlineStatus(isOnline) {
        if (isOnline) {
            this.showNotification('Соединение восстановлено', 'success');
        } else {
            this.showNotification('Работаем в оффлайн режиме', 'warning');
        }
    }

    async navigateTo(page) {
        console.log('Переход на страницу:', page);
        // Реализация навигации
    }
} // КОНЕЦ КЛАССА - ЗДЕСЬ ДОЛЖНА БЫТЬ ЗАКРЫВАЮЩАЯ ФИГУРНАЯ СКОБКА

// ============ ИНИЦИАЛИЗАЦИЯ ============
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new EstimatorApp();
    window.app = app;
});
// ============ КОНЕЦ ФАЙЛА ============
