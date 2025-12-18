// Основной модуль приложения
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
            
            // Пробуем загрузить данные из файлов (исправлены пути)
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
            
            // Инициализируем IndexedDB
            const db = await this.openDB();
            
            // Проверяем существующие данные
            const [existingItems, existingTemplates] = await Promise.all([
                this.getAllFromStore(db, 'items'),
                this.getAllFromStore(db, 'templates')
            ]);
            
            // Если база пуста, создаем дефолтные данные
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
            // Создаем минимальные данные
            const db = await this.openDB();
            await this.createDefaultData(db);
        }
    }

    async createDefaultData(db) {
        try {
            console.log('Создание дефолтных данных...');
            
            // Дефолтные категории
            const defaultCategories = [
                { id: 'basic-materials', name: 'Основные материалы', sortOrder: 1, type: 'category' },
                { id: 'profiles', name: 'Профили и крепления', sortOrder: 2, type: 'category' },
                { id: 'electrical', name: 'Электромонтажные работы', sortOrder: 3, type: 'category' },
                { id: 'additional', name: 'Дополнительные работы', sortOrder: 4, type: 'category' },
                { id: 'cornices', name: 'Карнизы', sortOrder: 5, type: 'category' },
                { id: 'complex', name: 'Сложные работы', sortOrder: 6, type: 'category' }
            ];
            
            // Дефолтные позиции
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
            
            // Сохраняем категории
            const itemsTransaction = db.transaction(['items'], 'readwrite');
            const itemsStore = itemsTransaction.objectStore('items');
            
            for (const category of defaultCategories) {
                await itemsStore.put({
                    ...category,
                    createdAt: new Date().toISOString()
                });
            }
            
            // Сохраняем позиции
            for (const item of defaultItems) {
                await itemsStore.put({
                    ...item,
                    createdAt: new Date().toISOString(),
                    type: 'item'
                });
            }
            
            // Дефолтные шаблоны
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

        // Кнопки меню
        document.getElementById('menu-toggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('close-menu')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('export-all')?.addEventListener('click', () => this.exportAllData());

        // Создание сметы
        document.getElementById('new-estimate')?.addEventListener('click', () => {
            this.navigateTo('create');
            this.createNewEstimate();
        });

        // Сохранение сметы
        document.getElementById('save-estimate')?.addEventListener('click', () => this.saveEstimate());

        // Добавление позиций
        document.getElementById('add-item')?.addEventListener('click', () => this.showAddItemModal());
        document.getElementById('add-from-template')?.addEventListener('click', () => this.showTemplatesModal());

        // Экспорт PDF
        document.getElementById('export-pdf')?.addEventListener('click', () => this.generatePDF());
        document.getElementById('preview-pdf')?.addEventListener('click', () => this.previewPDF());

        // Поиск и фильтры
        const searchInput = document.getElementById('search-estimates');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchEstimates(e.target.value));
        }
        
        const filterStatus = document.getElementById('filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.filterEstimates());
        }
        
        const sortBy = document.getElementById('sort-by');
        if (sortBy) {
            sortBy.addEventListener('change', () => this.sortEstimates());
        }

        // Синхронизация
        document.getElementById('sync-button')?.addEventListener('click', () => this.syncData());

        // Экспорт/импорт
        document.getElementById('export-json')?.addEventListener('click', () => this.exportDataToJSON());
        document.getElementById('import-json')?.addEventListener('change', (e) => this.importDataFromJSON(e));
        document.getElementById('export-items')?.addEventListener('click', () => this.exportItemsToJSON());
        document.getElementById('import-items')?.addEventListener('change', (e) => this.importItemsFromJSON(e));
        document.getElementById('reset-items')?.addEventListener('click', () => this.resetToFactoryDefaults());
        document.getElementById('import-excel')?.addEventListener('click', () => this.showExcelImportModal());

        // Обработка изменений в таблице
        document.addEventListener('input', (e) => {
            if (e.target.matches('.item-qty, .item-price')) {
                this.updateItemTotal(e.target);
            }
            if (e.target.id === 'discount') {
                this.updateTotals();
            }
        });

        // Установка PWA
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => this.installApp());
            }
        });

        // Онлайн/оффлайн статус
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        // Проверка обновлений Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker обновлен, перезагружаем...');
                window.location.reload();
            });
        }
    }

    async navigateTo(page) {
        if (window.innerWidth < 769) {
            this.toggleSidebar(false);
        }

        // Обновляем активные элементы меню
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Прячем все страницы
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Показываем нужную страницу
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            this.currentPage = page;
            
            const title = pageElement.querySelector('h2');
            if (title) {
                document.getElementById('current-page').textContent = title.textContent;
            }
            
            // Загружаем данные для страницы
            switch(page) {
                case 'estimates':
                    await this.loadEstimates();
                    break;
                case 'create':
                    this.setupEstimateForm();
                    break;
                case 'templates':
                    await this.loadTemplates();
                    break;
                case 'items':
                    await this.loadItemsManager();
                    break;
            }
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
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }

    async loadEstimates() {
        const listElement = document.getElementById('estimates-list');
        if (!listElement) return;
        
        if (this.estimates.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Нет смет</h3>
                    <p>Создайте свою первую смету</p>
                    <button id="create-first-estimate" class="btn-primary">➕ Создать смету</button>
                </div>
            `;
            document.getElementById('create-first-estimate').addEventListener('click', () => {
                this.navigateTo('create');
                this.createNewEstimate();
            });
            return;
        }

        // Фильтрация и сортировка
        const filtered = this.filterEstimatesData();
        const sorted = this.sortEstimatesData(filtered);
        
        // Генерация HTML
        listElement.innerHTML = sorted.map(estimate => this.renderEstimateCard(estimate)).join('');
        
        // Добавляем обработчики кликов
        document.querySelectorAll('.estimate-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.estimate-actions')) {
                    const id = card.dataset.id;
                    this.editEstimate(id);
                }
            });
        });
    }

    filterEstimatesData() {
        const filterStatus = document.getElementById('filter-status');
        const status = filterStatus ? filterStatus.value : 'all';
        
        if (status === 'all') {
            return this.estimates;
        }
        
        return this.estimates.filter(estimate => estimate.status === status);
    }

    sortEstimatesData(estimates) {
        const sortBy = document.getElementById('sort-by');
        const sortValue = sortBy ? sortBy.value : 'date-desc';
        
        return [...estimates].sort((a, b) => {
            switch(sortValue) {
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'amount':
                    return (b.total || 0) - (a.total || 0);
                case 'date-desc':
                default:
                    return new Date(b.date) - new Date(a.date);
            }
        });
    }

    searchEstimates(query) {
        const listElement = document.getElementById('estimates-list');
        if (!listElement || !query.trim()) {
            this.loadEstimates();
            return;
        }
        
        const filtered = this.estimates.filter(estimate => 
            estimate.name.toLowerCase().includes(query.toLowerCase()) ||
            (estimate.object && estimate.object.toLowerCase().includes(query.toLowerCase())) ||
            (estimate.address && estimate.address.toLowerCase().includes(query.toLowerCase()))
        );
        
        listElement.innerHTML = filtered.map(estimate => this.renderEstimateCard(estimate)).join('');
    }

    renderEstimateCard(estimate) {
        const date = estimate.date ? new Date(estimate.date).toLocaleDateString('ru-RU') : '-';
        const statusText = {
            'draft': 'Черновик',
            'sent': 'Отправлено',
            'accepted': 'Принято',
            'completed': 'Завершено'
        }[estimate.status] || 'Черновик';
        
        const total = estimate.total || 0;
        
        return `
            <div class="estimate-card" data-id="${estimate.id}">
                <div class="estimate-header">
                    <div>
                        <h3 class="estimate-title">${estimate.name || 'Без названия'}</h3>
                        <div class="estimate-details">
                            <div>${estimate.object || 'Объект не указан'}</div>
                            <div>Создано: ${date}</div>
                        </div>
                    </div>
                    <span class="estimate-status status-${estimate.status || 'draft'}">${statusText}</span>
                </div>
                <div class="estimate-info">
                    <div class="estimate-metrics">
                        ${estimate.area ? `<span>Площадь: ${estimate.area} м²</span>` : ''}
                        ${estimate.perimeter ? `<span>Периметр: ${estimate.perimeter} м</span>` : ''}
                    </div>
                    <div class="estimate-total">
                        <strong>${total.toLocaleString('ru-RU')} руб.</strong>
                    </div>
                </div>
                <div class="estimate-footer">
                    <div class="estimate-actions">
                        <button class="icon-button" onclick="app.deleteEstimate('${estimate.id}', event)">🗑️</button>
                        <button class="icon-button" onclick="app.duplicateEstimate('${estimate.id}', event)">📋</button>
                        <button class="icon-button" onclick="app.exportEstimatePDF('${estimate.id}', event)">📄</button>
                    </div>
                    <span class="estimate-rooms">${estimate.rooms || 1} помещ.</span>
                </div>
            </div>
        `;
    }

    createNewEstimate() {
        this.currentEstimate = {
            id: this.generateId(),
            name: 'Новая смета',
            object: 'Квартира',
            address: '',
            rooms: 1,
            area: 0,
            perimeter: 0,
            height: 0,
            status: 'draft',
            date: new Date().toISOString().split('T')[0],
            items: [],
            notes: '',
            total: 0,
            discount: 0,
            finalTotal: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const titleElement = document.getElementById('edit-title');
        if (titleElement) {
            titleElement.textContent = 'Новая смета';
        }
        this.setupEstimateForm();
    }

    setupEstimateForm() {
        if (!this.currentEstimate) {
            this.createNewEstimate();
            return;
        }

        // Заполняем форму
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value || '';
        };

        setValue('estimate-name', this.currentEstimate.name);
        setValue('estimate-object', this.currentEstimate.object);
        setValue('estimate-address', this.currentEstimate.address);
        setValue('estimate-rooms', this.currentEstimate.rooms);
        setValue('estimate-status', this.currentEstimate.status);
        setValue('estimate-date', this.currentEstimate.date);
        setValue('area-s', this.currentEstimate.area);
        setValue('perimeter-p', this.currentEstimate.perimeter);
        setValue('height-h', this.currentEstimate.height);
        setValue('estimate-notes', this.currentEstimate.notes);
        setValue('discount', this.currentEstimate.discount || 0);

        // Заполняем таблицу позиций
        this.renderItemsTable();
        this.updateTotals();
    }

    renderItemsTable() {
        const tbody = document.getElementById('items-tbody');
        if (!tbody) return;
        
        if (!this.currentEstimate.items || this.currentEstimate.items.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <p>Нет позиций</p>
                            <button type="button" class="btn-secondary" onclick="app.showAddItemModal()">➕ Добавить позицию</button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentEstimate.items.map((item, index) => `
            <tr data-id="${item.id}">
                <td>${index + 1}</td>
                <td>
                    <input type="text" class="item-name" value="${item.name}" 
                           onchange="app.updateItemField('${item.id}', 'name', this.value)">
                </td>
                <td>
                    <select class="item-unit" onchange="app.updateItemField('${item.id}', 'unit', this.value)">
                        <option value="м²" ${item.unit === 'м²' ? 'selected' : ''}>м²</option>
                        <option value="м.п." ${item.unit === 'м.п.' ? 'selected' : ''}>м.п.</option>
                        <option value="шт." ${item.unit === 'шт.' ? 'selected' : ''}>шт.</option>
                        <option value="компл." ${item.unit === 'компл.' ? 'selected' : ''}>компл.</option>
                    </select>
                </td>
                <td>
                    <input type="number" class="item-qty" value="${item.quantity || 0}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'quantity', parseFloat(this.value))">
                </td>
                <td>
                    <input type="number" class="item-price" value="${item.price || 0}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'price', parseFloat(this.value))">
                </td>
                <td class="item-total">${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                <td>
                    <button class="icon-button" onclick="app.removeItem('${item.id}', event)">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    updateItemField(itemId, field, value) {
        if (!this.currentEstimate || !this.currentEstimate.items) return;
        
        const item = this.currentEstimate.items.find(i => i.id === itemId);
        if (item) {
            item[field] = value;
            item.total = (item.quantity || 0) * (item.price || 0);
            
            // Обновляем отображение
            const row = document.querySelector(`[data-id="${itemId}"]`);
            if (row) {
                row.querySelector('.item-total').textContent = item.total.toFixed(2);
            }
            
            this.updateTotals();
        }
    }

    updateItemTotal(input) {
        const row = input.closest('tr');
        if (!row) return;
        
        const qtyInput = row.querySelector('.item-qty');
        const priceInput = row.querySelector('.item-price');
        const totalCell = row.querySelector('.item-total');
        
        if (qtyInput && priceInput && totalCell) {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const total = qty * price;
            totalCell.textContent = total.toFixed(2);
            
            // Обновляем данные
            const itemId = row.dataset.id;
            if (itemId) {
                this.updateItemField(itemId, 'quantity', qty);
                this.updateItemField(itemId, 'price', price);
            }
        }
    }

    async saveEstimate() {
        if (!this.currentEstimate) return;

        // Собираем данные из формы
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value : '';
        };

        this.currentEstimate.name = getValue('estimate-name');
        this.currentEstimate.object = getValue('estimate-object');
        this.currentEstimate.address = getValue('estimate-address');
        this.currentEstimate.rooms = parseInt(getValue('estimate-rooms')) || 1;
        this.currentEstimate.status = getValue('estimate-status');
        this.currentEstimate.date = getValue('estimate-date');
        this.currentEstimate.area = parseFloat(getValue('area-s')) || 0;
        this.currentEstimate.perimeter = parseFloat(getValue('perimeter-p')) || 0;
        this.currentEstimate.height = parseFloat(getValue('height-h')) || 0;
        this.currentEstimate.notes = getValue('estimate-notes');
        this.currentEstimate.discount = parseFloat(getValue('discount')) || 0;

        // Обновляем итоги
        this.updateTotals();

        // Сохраняем в IndexedDB
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readwrite');
            const store = transaction.objectStore('estimates');
            
            this.currentEstimate.updatedAt = new Date().toISOString();
            await store.put(this.currentEstimate);
            
            // Обновляем локальный список
            const index = this.estimates.findIndex(e => e.id === this.currentEstimate.id);
            if (index !== -1) {
                this.estimates[index] = this.currentEstimate;
            } else {
                this.estimates.push(this.currentEstimate);
            }
            
            this.showNotification('Смета сохранена', 'success');
            
            // Возвращаемся к списку смет
            setTimeout(() => this.navigateTo('estimates'), 1000);
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showNotification('Ошибка сохранения', 'error');
        }
    }

    updateTotals() {
        if (!this.currentEstimate) return;
        
        const items = this.currentEstimate.items || [];
        const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
        const discount = parseFloat(document.getElementById('discount')?.value) || 0;
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;
        
        // Обновляем отображение
        const totalElement = document.getElementById('total-amount');
        const discountElement = document.getElementById('discount-amount');
        const finalElement = document.getElementById('final-amount');
        
        if (totalElement) totalElement.textContent = subtotal.toFixed(2);
        if (discountElement) discountElement.textContent = discountAmount.toFixed(2);
        if (finalElement) finalElement.textContent = total.toFixed(2);
        
        // Обновляем объект сметы
        this.currentEstimate.total = subtotal;
        this.currentEstimate.discount = discount;
        this.currentEstimate.finalTotal = total;
    }

    async editEstimate(estimateId) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = () => {
                this.currentEstimate = request.result;
                this.navigateTo('create');
                document.getElementById('edit-title').textContent = 'Редактирование сметы';
                this.setupEstimateForm();
            };
            
            request.onerror = () => {
                this.showNotification('Ошибка загрузки сметы', 'error');
            };
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка загрузки сметы', 'error');
        }
    }

    async deleteEstimate(estimateId, event) {
        if (event) event.stopPropagation();
        
        if (!confirm('Удалить эту смету?')) return;
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readwrite');
            const store = transaction.objectStore('estimates');
            
            await store.delete(estimateId);
            
            // Удаляем из локального списка
            this.estimates = this.estimates.filter(e => e.id !== estimateId);
            
            // Обновляем отображение
            await this.loadEstimates();
            
            this.showNotification('Смета удалена', 'success');
            
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.showNotification('Ошибка удаления', 'error');
        }
    }

    async duplicateEstimate(estimateId, event) {
        if (event) event.stopPropagation();
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = () => {
                const original = request.result;
                const duplicate = {
                    ...original,
                    id: this.generateId(),
                    name: `Копия: ${original.name}`,
                    date: new Date().toISOString().split('T')[0],
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Удаляем старый id из items
                duplicate.items = duplicate.items.map(item => ({
                    ...item,
                    id: this.generateId()
                }));
                
                this.currentEstimate = duplicate;
                this.navigateTo('create');
                document.getElementById('edit-title').textContent = 'Копия сметы';
                this.setupEstimateForm();
            };
            
        } catch (error) {
            console.error('Ошибка копирования:', error);
            this.showNotification('Ошибка копирования', 'error');
        }
    }

    async exportEstimatePDF(estimateId, event) {
        if (event) event.stopPropagation();
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = async () => {
                const estimate = request.result;
                const { generateEstimatePDF } = await import('./pdf-generator.js');
                const pdf = await generateEstimatePDF(estimate, this.companyData);
                
                const fileName = `Смета_${estimate.name}_${new Date().toISOString().split('T')[0]}.pdf`;
                pdf.save(fileName);
                
                this.showNotification('PDF скачан', 'success');
            };
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    showAddItemModal() {
        const modal = document.getElementById('add-item-modal');
        if (!modal) return;
        
        modal.querySelector('.modal-body').innerHTML = `
            <form id="add-item-form">
                <div class="form-group">
                    <label>Наименование *</label>
                    <input type="text" id="item-name" required>
                </div>
                <div class="form-group">
                    <label>Единица измерения</label>
                    <select id="item-unit">
                        <option value="м²">м²</option>
                        <option value="м.п.">м.п.</option>
                        <option value="шт.">шт.</option>
                        <option value="компл.">компл.</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="item-quantity" value="1" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Цена, руб.</label>
                    <input type="number" id="item-price" value="0" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <select id="item-category">
                        ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary modal-close">Отмена</button>
                    <button type="submit" class="btn-primary">Добавить</button>
                </div>
            </form>
        `;
        
        this.showModal('add-item-modal');
        
        // Обработка формы
        document.getElementById('add-item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItemFromModal();
        });
    }

    addItemFromModal() {
        const name = document.getElementById('item-name').value;
        const unit = document.getElementById('item-unit').value;
        const quantity = parseFloat(document.getElementById('item-quantity').value) || 0;
        const price = parseFloat(document.getElementById('item-price').value) || 0;
        const category = document.getElementById('item-category').value;
        
        if (!name.trim()) {
            this.showNotification('Введите наименование', 'warning');
            return;
        }
        
        const newItem = {
            id: this.generateId(),
            name: name.trim(),
            unit: unit,
            quantity: quantity,
            price: price,
            category: category,
            total: quantity * price
        };
        
        if (!this.currentEstimate.items) {
            this.currentEstimate.items = [];
        }
        
        this.currentEstimate.items.push(newItem);
        this.renderItemsTable();
        this.updateTotals();
        this.hideModal('add-item-modal');
        this.showNotification('Позиция добавлена', 'success');
    }

    removeItem(itemId, event) {
        if (event) event.stopPropagation();
        
        if (!confirm('Удалить эту позицию?')) return;
        
        this.currentEstimate.items = this.currentEstimate.items.filter(item => item.id !== itemId);
        this.renderItemsTable();
        this.updateTotals();
        this.showNotification('Позиция удалена', 'success');
    }

    async generatePDF() {
        if (!this.currentEstimate) {
            this.showNotification('Сначала создайте смету', 'warning');
            return;
        }
        
        try {
            const { generateEstimatePDF } = await import('./pdf-generator.js');
            
            // Генерируем PDF
            const pdf = await generateEstimatePDF(this.currentEstimate, this.companyData);
            
            // Скачиваем файл
            const fileName = `Смета_${this.currentEstimate.name}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            
            this.showNotification('PDF создан и скачан', 'success');
            
        } catch (error) {
            console.error('Ошибка генерации PDF:', error);
            this.showNotification('Ошибка создания PDF', 'error');
        }
    }

    async previewPDF() {
        if (!this.currentEstimate) {
            this.showNotification('Сначала создайте смету', 'warning');
            return;
        }
        
        try {
            const { generateEstimateHTML } = await import('./pdf-generator.js');
            const html = generateEstimateHTML(this.currentEstimate, this.companyData);
            
            const previewContent = document.getElementById('pdf-preview-content');
            if (previewContent) {
                previewContent.innerHTML = html;
                this.showModal('pdf-preview-modal');
            }
            
        } catch (error) {
            console.error('Ошибка предпросмотра:', error);
            this.showNotification('Ошибка предпросмотра', 'error');
        }
    }

    // Вспомогательные методы
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

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        
        if (!modal || !overlay) return;
        
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        // Закрытие по клику на overlay
        overlay.addEventListener('click', () => this.hideModal(modalId));
        
        // Закрытие по кнопке
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal(modalId));
        });
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
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
                
                // Восстанавливаем тему
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark') {
                    document.body.classList.add('dark-theme');
                    document.getElementById('theme-toggle').textContent = '☀️';
                }
                
                // Загружаем первую страницу
                this.navigateTo('estimates');
                
            }, 500);
        }, 1000);
    }

    checkInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Показываем кнопку установки в меню
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

    async syncData() {
        this.showNotification('Синхронизация...', 'info');
        
        try {
            if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker.ready) {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-data');
                this.showNotification('Синхронизация запущена', 'success');
            } else {
                this.showNotification('Фоновая синхронизация не поддерживается', 'warning');
            }
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            this.showNotification('Ошибка синхронизации', 'error');
        }
    }

    updateOnlineStatus(isOnline) {
        if (isOnline) {
            this.showNotification('Соединение восстановлено', 'success');
        } else {
            this.showNotification('Работаем в оффлайн режиме', 'warning');
        }
    }

    // IndexedDB методы
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EstimatorDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                // Создаем хранилище для смет
                if (!db.objectStoreNames.contains('estimates')) {
                    const store = db.createObjectStore('estimates', { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Создаем хранилище для шаблонов
                if (!db.objectStoreNames.contains('templates')) {
                    const store = db.createObjectStore('templates', { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Создаем хранилище для позиций и категорий
                if (!db.objectStoreNames.contains('items')) {
                    const store = db.createObjectStore('items', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('isActive', 'isActive', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Миграция с версии 1 на 2
                if (oldVersion < 2) {
                    // Добавляем новые индексы если нужно
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

    // Экспорт/импорт данных
    async exportAllData() {
        try {
            const db = await this.openDB();
            
            // Экспорт всех данных
            const [estimates, templates, items] = await Promise.all([
                this.getAllFromStore(db, 'estimates'),
                this.getAllFromStore(db, 'templates'),
                this.getAllFromStore(db, 'items')
            ]);
            
            const allData = {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                estimates,
                templates,
                items
            };
            
            const blob = new Blob(
                [JSON.stringify(allData, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `estimator_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Все данные экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта данных:', error);
            this.showNotification('Ошибка экспорта данных', 'error');
        }
    }

    async exportDataToJSON() {
        try {
            const db = await this.openDB();
            const estimates = await this.getAllFromStore(db, 'estimates');
            
            const blob = new Blob(
                [JSON.stringify(estimates, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `estimates_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Сметы экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    async exportItemsToJSON() {
        try {
            const db = await this.openDB();
            const items = await this.getAllFromStore(db, 'items');
            
            // Фильтруем только активные позиции (не категории)
            const activeItems = items.filter(item => item.isActive !== false && item.type !== 'category');
            
            const blob = new Blob(
                [JSON.stringify(activeItems, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `items_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Позиции экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта позиций:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    async importDataFromJSON(event) {
        if (!confirm('Импортировать данные? Существующие сметы будут сохранены.')) {
            return;
        }
        
        try {
            const file = event.target.files[0];
            if (!file) {
                this.showNotification('Файл не выбран', 'warning');
                return;
            }
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!Array.isArray(data)) {
                throw new Error('Некорректный формат данных');
            }
            
            // Определяем тип данных
            if (data.length > 0) {
                const firstItem = data[0];
                
                if (firstItem.items && firstItem.name && firstItem.object) {
                    // Это сметы
                    await this.importEstimates(data);
                    this.showNotification('Сметы импортированы', 'success');
                } else if (firstItem.name && firstItem.unit && firstItem.price !== undefined) {
                    // Это позиции
                    await this.importItems(data);
                    this.showNotification('Позиции импортированы', 'success');
                } else {
                    throw new Error('Неизвестный формат данных');
                }
            }
            
            // Перезагружаем данные
            await this.loadData();
            
        } catch (error) {
            console.error('Ошибка импорта:', error);
            this.showNotification(`Ошибка импорта: ${error.message}`, 'error');
        }
    }

    async importItemsFromJSON(event) {
        if (!confirm('Импортировать позиции? Существующие данные будут сохранены.')) {
            return;
        }
        
        try {
            await this.importDataFromJSON(event);
        } catch (error) {
            console.error('Ошибка импорта позиций:', error);
        }
    }

    async importEstimates(estimates) {
        const db = await this.openDB();
        const transaction = db.transaction(['estimates'], 'readwrite');
        const store = transaction.objectStore('estimates');
        
        for (const estimate of estimates) {
            const newEstimate = {
                ...estimate,
                id: estimate.id || this.generateId(),
                createdAt: estimate.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Обновляем ID для всех позиций в смете
            if (newEstimate.items && Array.isArray(newEstimate.items)) {
                newEstimate.items = newEstimate.items.map(item => ({
                    ...item,
                    id: item.id || this.generateId()
                }));
            }
            
            await store.put(newEstimate);
        }
        
        this.estimates = await this.getAllFromStore(db, 'estimates');
    }

    async importItems(items) {
        const db = await this.openDB();
        const transaction = db.transaction(['items'], 'readwrite');
        const store = transaction.objectStore('items');
        
        for (const item of items) {
            const newItem = {
                ...item,
                id: item.id || this.generateId(),
                type: item.type || 'item',
                isActive: item.isActive !== false,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await store.put(newItem);
        }
        
        this.items = await this.getAllFromStore(db, 'items');
    }

    async resetToFactoryDefaults() {
        if (!confirm('Восстановить заводские настройки? Все ваши изменения в позициях будут потеряны.')) {
            return;
        }
        
        try {
            // Очищаем базу данных позиций
            const db = await this.openDB();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            await store.clear();
            
            // Создаем новые данные
            await this.createDefaultData(db);
            
            // Обновляем данные
            await this.loadData();
            
            this.showNotification('Данные восстановлены к заводским', 'success');
            
        } catch (error) {
            console.error('Ошибка сброса:', error);
            this.showNotification('Ошибка сброса данных', 'error');
        }
    }

    showExcelImportModal() {
        this.showNotification('Функция в разработке', 'info');
    }

    async loadTemplates() {
        console.log('Загрузка шаблонов...');
    }

    async loadItemsManager() {
        console.log('Загрузка менеджера позиций...');
    }

    showTemplatesModal() {
        this.showNotification('Функция в разработке', 'info');
    }
}

// Инициализация приложения при загрузке
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new EstimatorApp();
    window.app = app; // Делаем глобально доступным для обработчиков
});

// === УДАЛЕНО: Дублирующая регистрация Service Worker ===
// Весь код регистрации Service Worker должен быть только в index.html// Основной модуль приложения
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
            
            // Пробуем загрузить данные из файлов
            const urls = [
                '/data/default-templates.json',
                '/data/default-items.json', 
                '/data/company-info.json',
                '/data/settings.json'
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
            
            // Инициализируем IndexedDB
            const db = await this.openDB();
            
            // Проверяем существующие данные
            const [existingItems, existingTemplates] = await Promise.all([
                this.getAllFromStore(db, 'items'),
                this.getAllFromStore(db, 'templates')
            ]);
            
            // Если база пуста, создаем дефолтные данные
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
            // Создаем минимальные данные
            const db = await this.openDB();
            await this.createDefaultData(db);
        }
    }

    async createDefaultData(db) {
        try {
            console.log('Создание дефолтных данных...');
            
            // Дефолтные категории
            const defaultCategories = [
                { id: 'basic-materials', name: 'Основные материалы', sortOrder: 1, type: 'category' },
                { id: 'profiles', name: 'Профили и крепления', sortOrder: 2, type: 'category' },
                { id: 'electrical', name: 'Электромонтажные работы', sortOrder: 3, type: 'category' },
                { id: 'additional', name: 'Дополнительные работы', sortOrder: 4, type: 'category' },
                { id: 'cornices', name: 'Карнизы', sortOrder: 5, type: 'category' },
                { id: 'complex', name: 'Сложные работы', sortOrder: 6, type: 'category' }
            ];
            
            // Дефолтные позиции
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
            
            // Сохраняем категории
            const itemsTransaction = db.transaction(['items'], 'readwrite');
            const itemsStore = itemsTransaction.objectStore('items');
            
            for (const category of defaultCategories) {
                await itemsStore.put({
                    ...category,
                    createdAt: new Date().toISOString()
                });
            }
            
            // Сохраняем позиции
            for (const item of defaultItems) {
                await itemsStore.put({
                    ...item,
                    createdAt: new Date().toISOString(),
                    type: 'item'
                });
            }
            
            // Дефолтные шаблоны
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

        // Кнопки меню
        document.getElementById('menu-toggle')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('close-menu')?.addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('export-all')?.addEventListener('click', () => this.exportAllData());

        // Создание сметы
        document.getElementById('new-estimate')?.addEventListener('click', () => {
            this.navigateTo('create');
            this.createNewEstimate();
        });

        // Сохранение сметы
        document.getElementById('save-estimate')?.addEventListener('click', () => this.saveEstimate());

        // Добавление позиций
        document.getElementById('add-item')?.addEventListener('click', () => this.showAddItemModal());
        document.getElementById('add-from-template')?.addEventListener('click', () => this.showTemplatesModal());

        // Экспорт PDF
        document.getElementById('export-pdf')?.addEventListener('click', () => this.generatePDF());
        document.getElementById('preview-pdf')?.addEventListener('click', () => this.previewPDF());

        // Поиск и фильтры
        const searchInput = document.getElementById('search-estimates');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.searchEstimates(e.target.value));
        }
        
        const filterStatus = document.getElementById('filter-status');
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.filterEstimates());
        }
        
        const sortBy = document.getElementById('sort-by');
        if (sortBy) {
            sortBy.addEventListener('change', () => this.sortEstimates());
        }

        // Синхронизация
        document.getElementById('sync-button')?.addEventListener('click', () => this.syncData());

        // Экспорт/импорт
        document.getElementById('export-json')?.addEventListener('click', () => this.exportDataToJSON());
        document.getElementById('import-json')?.addEventListener('change', (e) => this.importDataFromJSON(e));
        document.getElementById('export-items')?.addEventListener('click', () => this.exportItemsToJSON());
        document.getElementById('import-items')?.addEventListener('change', (e) => this.importItemsFromJSON(e));
        document.getElementById('reset-items')?.addEventListener('click', () => this.resetToFactoryDefaults());
        document.getElementById('import-excel')?.addEventListener('click', () => this.showExcelImportModal());

        // Обработка изменений в таблице
        document.addEventListener('input', (e) => {
            if (e.target.matches('.item-qty, .item-price')) {
                this.updateItemTotal(e.target);
            }
            if (e.target.id === 'discount') {
                this.updateTotals();
            }
        });

        // Установка PWA
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => this.installApp());
            }
        });

        // Онлайн/оффлайн статус
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));
        
        // Проверка обновлений Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('Service Worker обновлен, перезагружаем...');
                window.location.reload();
            });
        }
    }

    async navigateTo(page) {
        if (window.innerWidth < 769) {
            this.toggleSidebar(false);
        }

        // Обновляем активные элементы меню
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Прячем все страницы
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        
        // Показываем нужную страницу
        const pageElement = document.getElementById(`${page}-page`);
        if (pageElement) {
            pageElement.classList.add('active');
            this.currentPage = page;
            
            const title = pageElement.querySelector('h2');
            if (title) {
                document.getElementById('current-page').textContent = title.textContent;
            }
            
            // Загружаем данные для страницы
            switch(page) {
                case 'estimates':
                    await this.loadEstimates();
                    break;
                case 'create':
                    this.setupEstimateForm();
                    break;
                case 'templates':
                    await this.loadTemplates();
                    break;
                case 'items':
                    await this.loadItemsManager();
                    break;
            }
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
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }

    async loadEstimates() {
        const listElement = document.getElementById('estimates-list');
        if (!listElement) return;
        
        if (this.estimates.length === 0) {
            listElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Нет смет</h3>
                    <p>Создайте свою первую смету</p>
                    <button id="create-first-estimate" class="btn-primary">➕ Создать смету</button>
                </div>
            `;
            document.getElementById('create-first-estimate').addEventListener('click', () => {
                this.navigateTo('create');
                this.createNewEstimate();
            });
            return;
        }

        // Фильтрация и сортировка
        const filtered = this.filterEstimatesData();
        const sorted = this.sortEstimatesData(filtered);
        
        // Генерация HTML
        listElement.innerHTML = sorted.map(estimate => this.renderEstimateCard(estimate)).join('');
        
        // Добавляем обработчики кликов
        document.querySelectorAll('.estimate-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.estimate-actions')) {
                    const id = card.dataset.id;
                    this.editEstimate(id);
                }
            });
        });
    }

    filterEstimatesData() {
        const filterStatus = document.getElementById('filter-status');
        const status = filterStatus ? filterStatus.value : 'all';
        
        if (status === 'all') {
            return this.estimates;
        }
        
        return this.estimates.filter(estimate => estimate.status === status);
    }

    sortEstimatesData(estimates) {
        const sortBy = document.getElementById('sort-by');
        const sortValue = sortBy ? sortBy.value : 'date-desc';
        
        return [...estimates].sort((a, b) => {
            switch(sortValue) {
                case 'date-asc':
                    return new Date(a.date) - new Date(b.date);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'amount':
                    return (b.total || 0) - (a.total || 0);
                case 'date-desc':
                default:
                    return new Date(b.date) - new Date(a.date);
            }
        });
    }

    searchEstimates(query) {
        const listElement = document.getElementById('estimates-list');
        if (!listElement || !query.trim()) {
            this.loadEstimates();
            return;
        }
        
        const filtered = this.estimates.filter(estimate => 
            estimate.name.toLowerCase().includes(query.toLowerCase()) ||
            (estimate.object && estimate.object.toLowerCase().includes(query.toLowerCase())) ||
            (estimate.address && estimate.address.toLowerCase().includes(query.toLowerCase()))
        );
        
        listElement.innerHTML = filtered.map(estimate => this.renderEstimateCard(estimate)).join('');
    }

    renderEstimateCard(estimate) {
        const date = estimate.date ? new Date(estimate.date).toLocaleDateString('ru-RU') : '-';
        const statusText = {
            'draft': 'Черновик',
            'sent': 'Отправлено',
            'accepted': 'Принято',
            'completed': 'Завершено'
        }[estimate.status] || 'Черновик';
        
        const total = estimate.total || 0;
        
        return `
            <div class="estimate-card" data-id="${estimate.id}">
                <div class="estimate-header">
                    <div>
                        <h3 class="estimate-title">${estimate.name || 'Без названия'}</h3>
                        <div class="estimate-details">
                            <div>${estimate.object || 'Объект не указан'}</div>
                            <div>Создано: ${date}</div>
                        </div>
                    </div>
                    <span class="estimate-status status-${estimate.status || 'draft'}">${statusText}</span>
                </div>
                <div class="estimate-info">
                    <div class="estimate-metrics">
                        ${estimate.area ? `<span>Площадь: ${estimate.area} м²</span>` : ''}
                        ${estimate.perimeter ? `<span>Периметр: ${estimate.perimeter} м</span>` : ''}
                    </div>
                    <div class="estimate-total">
                        <strong>${total.toLocaleString('ru-RU')} руб.</strong>
                    </div>
                </div>
                <div class="estimate-footer">
                    <div class="estimate-actions">
                        <button class="icon-button" onclick="app.deleteEstimate('${estimate.id}', event)">🗑️</button>
                        <button class="icon-button" onclick="app.duplicateEstimate('${estimate.id}', event)">📋</button>
                        <button class="icon-button" onclick="app.exportEstimatePDF('${estimate.id}', event)">📄</button>
                    </div>
                    <span class="estimate-rooms">${estimate.rooms || 1} помещ.</span>
                </div>
            </div>
        `;
    }

    createNewEstimate() {
        this.currentEstimate = {
            id: this.generateId(),
            name: 'Новая смета',
            object: 'Квартира',
            address: '',
            rooms: 1,
            area: 0,
            perimeter: 0,
            height: 0,
            status: 'draft',
            date: new Date().toISOString().split('T')[0],
            items: [],
            notes: '',
            total: 0,
            discount: 0,
            finalTotal: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const titleElement = document.getElementById('edit-title');
        if (titleElement) {
            titleElement.textContent = 'Новая смета';
        }
        this.setupEstimateForm();
    }

    setupEstimateForm() {
        if (!this.currentEstimate) {
            this.createNewEstimate();
            return;
        }

        // Заполняем форму
        const setValue = (id, value) => {
            const element = document.getElementById(id);
            if (element) element.value = value || '';
        };

        setValue('estimate-name', this.currentEstimate.name);
        setValue('estimate-object', this.currentEstimate.object);
        setValue('estimate-address', this.currentEstimate.address);
        setValue('estimate-rooms', this.currentEstimate.rooms);
        setValue('estimate-status', this.currentEstimate.status);
        setValue('estimate-date', this.currentEstimate.date);
        setValue('area-s', this.currentEstimate.area);
        setValue('perimeter-p', this.currentEstimate.perimeter);
        setValue('height-h', this.currentEstimate.height);
        setValue('estimate-notes', this.currentEstimate.notes);
        setValue('discount', this.currentEstimate.discount || 0);

        // Заполняем таблицу позиций
        this.renderItemsTable();
        this.updateTotals();
    }

    renderItemsTable() {
        const tbody = document.getElementById('items-tbody');
        if (!tbody) return;
        
        if (!this.currentEstimate.items || this.currentEstimate.items.length === 0) {
            tbody.innerHTML = `
                <tr class="empty-row">
                    <td colspan="7" style="text-align: center; padding: 2rem;">
                        <div class="empty-state">
                            <p>Нет позиций</p>
                            <button type="button" class="btn-secondary" onclick="app.showAddItemModal()">➕ Добавить позицию</button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentEstimate.items.map((item, index) => `
            <tr data-id="${item.id}">
                <td>${index + 1}</td>
                <td>
                    <input type="text" class="item-name" value="${item.name}" 
                           onchange="app.updateItemField('${item.id}', 'name', this.value)">
                </td>
                <td>
                    <select class="item-unit" onchange="app.updateItemField('${item.id}', 'unit', this.value)">
                        <option value="м²" ${item.unit === 'м²' ? 'selected' : ''}>м²</option>
                        <option value="м.п." ${item.unit === 'м.п.' ? 'selected' : ''}>м.п.</option>
                        <option value="шт." ${item.unit === 'шт.' ? 'selected' : ''}>шт.</option>
                        <option value="компл." ${item.unit === 'компл.' ? 'selected' : ''}>компл.</option>
                    </select>
                </td>
                <td>
                    <input type="number" class="item-qty" value="${item.quantity || 0}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'quantity', parseFloat(this.value))">
                </td>
                <td>
                    <input type="number" class="item-price" value="${item.price || 0}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'price', parseFloat(this.value))">
                </td>
                <td class="item-total">${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                <td>
                    <button class="icon-button" onclick="app.removeItem('${item.id}', event)">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    updateItemField(itemId, field, value) {
        if (!this.currentEstimate || !this.currentEstimate.items) return;
        
        const item = this.currentEstimate.items.find(i => i.id === itemId);
        if (item) {
            item[field] = value;
            item.total = (item.quantity || 0) * (item.price || 0);
            
            // Обновляем отображение
            const row = document.querySelector(`[data-id="${itemId}"]`);
            if (row) {
                row.querySelector('.item-total').textContent = item.total.toFixed(2);
            }
            
            this.updateTotals();
        }
    }

    updateItemTotal(input) {
        const row = input.closest('tr');
        if (!row) return;
        
        const qtyInput = row.querySelector('.item-qty');
        const priceInput = row.querySelector('.item-price');
        const totalCell = row.querySelector('.item-total');
        
        if (qtyInput && priceInput && totalCell) {
            const qty = parseFloat(qtyInput.value) || 0;
            const price = parseFloat(priceInput.value) || 0;
            const total = qty * price;
            totalCell.textContent = total.toFixed(2);
            
            // Обновляем данные
            const itemId = row.dataset.id;
            if (itemId) {
                this.updateItemField(itemId, 'quantity', qty);
                this.updateItemField(itemId, 'price', price);
            }
        }
    }

    async saveEstimate() {
        if (!this.currentEstimate) return;

        // Собираем данные из формы
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value : '';
        };

        this.currentEstimate.name = getValue('estimate-name');
        this.currentEstimate.object = getValue('estimate-object');
        this.currentEstimate.address = getValue('estimate-address');
        this.currentEstimate.rooms = parseInt(getValue('estimate-rooms')) || 1;
        this.currentEstimate.status = getValue('estimate-status');
        this.currentEstimate.date = getValue('estimate-date');
        this.currentEstimate.area = parseFloat(getValue('area-s')) || 0;
        this.currentEstimate.perimeter = parseFloat(getValue('perimeter-p')) || 0;
        this.currentEstimate.height = parseFloat(getValue('height-h')) || 0;
        this.currentEstimate.notes = getValue('estimate-notes');
        this.currentEstimate.discount = parseFloat(getValue('discount')) || 0;

        // Обновляем итоги
        this.updateTotals();

        // Сохраняем в IndexedDB
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readwrite');
            const store = transaction.objectStore('estimates');
            
            this.currentEstimate.updatedAt = new Date().toISOString();
            await store.put(this.currentEstimate);
            
            // Обновляем локальный список
            const index = this.estimates.findIndex(e => e.id === this.currentEstimate.id);
            if (index !== -1) {
                this.estimates[index] = this.currentEstimate;
            } else {
                this.estimates.push(this.currentEstimate);
            }
            
            this.showNotification('Смета сохранена', 'success');
            
            // Возвращаемся к списку смет
            setTimeout(() => this.navigateTo('estimates'), 1000);
            
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            this.showNotification('Ошибка сохранения', 'error');
        }
    }

    updateTotals() {
        if (!this.currentEstimate) return;
        
        const items = this.currentEstimate.items || [];
        const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.price || 0)), 0);
        const discount = parseFloat(document.getElementById('discount')?.value) || 0;
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;
        
        // Обновляем отображение
        const totalElement = document.getElementById('total-amount');
        const discountElement = document.getElementById('discount-amount');
        const finalElement = document.getElementById('final-amount');
        
        if (totalElement) totalElement.textContent = subtotal.toFixed(2);
        if (discountElement) discountElement.textContent = discountAmount.toFixed(2);
        if (finalElement) finalElement.textContent = total.toFixed(2);
        
        // Обновляем объект сметы
        this.currentEstimate.total = subtotal;
        this.currentEstimate.discount = discount;
        this.currentEstimate.finalTotal = total;
    }

    async editEstimate(estimateId) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = () => {
                this.currentEstimate = request.result;
                this.navigateTo('create');
                document.getElementById('edit-title').textContent = 'Редактирование сметы';
                this.setupEstimateForm();
            };
            
            request.onerror = () => {
                this.showNotification('Ошибка загрузки сметы', 'error');
            };
            
        } catch (error) {
            console.error('Ошибка:', error);
            this.showNotification('Ошибка загрузки сметы', 'error');
        }
    }

    async deleteEstimate(estimateId, event) {
        if (event) event.stopPropagation();
        
        if (!confirm('Удалить эту смету?')) return;
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readwrite');
            const store = transaction.objectStore('estimates');
            
            await store.delete(estimateId);
            
            // Удаляем из локального списка
            this.estimates = this.estimates.filter(e => e.id !== estimateId);
            
            // Обновляем отображение
            await this.loadEstimates();
            
            this.showNotification('Смета удалена', 'success');
            
        } catch (error) {
            console.error('Ошибка удаления:', error);
            this.showNotification('Ошибка удаления', 'error');
        }
    }

    async duplicateEstimate(estimateId, event) {
        if (event) event.stopPropagation();
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = () => {
                const original = request.result;
                const duplicate = {
                    ...original,
                    id: this.generateId(),
                    name: `Копия: ${original.name}`,
                    date: new Date().toISOString().split('T')[0],
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                
                // Удаляем старый id из items
                duplicate.items = duplicate.items.map(item => ({
                    ...item,
                    id: this.generateId()
                }));
                
                this.currentEstimate = duplicate;
                this.navigateTo('create');
                document.getElementById('edit-title').textContent = 'Копия сметы';
                this.setupEstimateForm();
            };
            
        } catch (error) {
            console.error('Ошибка копирования:', error);
            this.showNotification('Ошибка копирования', 'error');
        }
    }

    async exportEstimatePDF(estimateId, event) {
        if (event) event.stopPropagation();
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readonly');
            const store = transaction.objectStore('estimates');
            const request = store.get(estimateId);
            
            request.onsuccess = async () => {
                const estimate = request.result;
                const { generateEstimatePDF } = await import('./pdf-generator.js');
                const pdf = await generateEstimatePDF(estimate, this.companyData);
                
                const fileName = `Смета_${estimate.name}_${new Date().toISOString().split('T')[0]}.pdf`;
                pdf.save(fileName);
                
                this.showNotification('PDF скачан', 'success');
            };
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    showAddItemModal() {
        const modal = document.getElementById('add-item-modal');
        if (!modal) return;
        
        modal.querySelector('.modal-body').innerHTML = `
            <form id="add-item-form">
                <div class="form-group">
                    <label>Наименование *</label>
                    <input type="text" id="item-name" required>
                </div>
                <div class="form-group">
                    <label>Единица измерения</label>
                    <select id="item-unit">
                        <option value="м²">м²</option>
                        <option value="м.п.">м.п.</option>
                        <option value="шт.">шт.</option>
                        <option value="компл.">компл.</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="item-quantity" value="1" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Цена, руб.</label>
                    <input type="number" id="item-price" value="0" step="0.01" min="0">
                </div>
                <div class="form-group">
                    <label>Категория</label>
                    <select id="item-category">
                        ${this.categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                    </select>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary modal-close">Отмена</button>
                    <button type="submit" class="btn-primary">Добавить</button>
                </div>
            </form>
        `;
        
        this.showModal('add-item-modal');
        
        // Обработка формы
        document.getElementById('add-item-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItemFromModal();
        });
    }

    addItemFromModal() {
        const name = document.getElementById('item-name').value;
        const unit = document.getElementById('item-unit').value;
        const quantity = parseFloat(document.getElementById('item-quantity').value) || 0;
        const price = parseFloat(document.getElementById('item-price').value) || 0;
        const category = document.getElementById('item-category').value;
        
        if (!name.trim()) {
            this.showNotification('Введите наименование', 'warning');
            return;
        }
        
        const newItem = {
            id: this.generateId(),
            name: name.trim(),
            unit: unit,
            quantity: quantity,
            price: price,
            category: category,
            total: quantity * price
        };
        
        if (!this.currentEstimate.items) {
            this.currentEstimate.items = [];
        }
        
        this.currentEstimate.items.push(newItem);
        this.renderItemsTable();
        this.updateTotals();
        this.hideModal('add-item-modal');
        this.showNotification('Позиция добавлена', 'success');
    }

    removeItem(itemId, event) {
        if (event) event.stopPropagation();
        
        if (!confirm('Удалить эту позицию?')) return;
        
        this.currentEstimate.items = this.currentEstimate.items.filter(item => item.id !== itemId);
        this.renderItemsTable();
        this.updateTotals();
        this.showNotification('Позиция удалена', 'success');
    }

    async generatePDF() {
        if (!this.currentEstimate) {
            this.showNotification('Сначала создайте смету', 'warning');
            return;
        }
        
        try {
            const { generateEstimatePDF } = await import('./pdf-generator.js');
            
            // Генерируем PDF
            const pdf = await generateEstimatePDF(this.currentEstimate, this.companyData);
            
            // Скачиваем файл
            const fileName = `Смета_${this.currentEstimate.name}_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(fileName);
            
            this.showNotification('PDF создан и скачан', 'success');
            
        } catch (error) {
            console.error('Ошибка генерации PDF:', error);
            this.showNotification('Ошибка создания PDF', 'error');
        }
    }

    async previewPDF() {
        if (!this.currentEstimate) {
            this.showNotification('Сначала создайте смету', 'warning');
            return;
        }
        
        try {
            const { generateEstimateHTML } = await import('./pdf-generator.js');
            const html = generateEstimateHTML(this.currentEstimate, this.companyData);
            
            const previewContent = document.getElementById('pdf-preview-content');
            if (previewContent) {
                previewContent.innerHTML = html;
                this.showModal('pdf-preview-modal');
            }
            
        } catch (error) {
            console.error('Ошибка предпросмотра:', error);
            this.showNotification('Ошибка предпросмотра', 'error');
        }
    }

    // Вспомогательные методы
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

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        
        if (!modal || !overlay) return;
        
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        // Закрытие по клику на overlay
        overlay.addEventListener('click', () => this.hideModal(modalId));
        
        // Закрытие по кнопке
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.hideModal(modalId));
        });
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        const overlay = document.getElementById('modal-overlay');
        
        if (modal) modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
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
                
                // Восстанавливаем тему
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'dark') {
                    document.body.classList.add('dark-theme');
                    document.getElementById('theme-toggle').textContent = '☀️';
                }
                
                // Загружаем первую страницу
                this.navigateTo('estimates');
                
            }, 500);
        }, 1000);
    }

    checkInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Показываем кнопку установки в меню
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

    async syncData() {
        this.showNotification('Синхронизация...', 'info');
        
        try {
            if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker.ready) {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-data');
                this.showNotification('Синхронизация запущена', 'success');
            } else {
                this.showNotification('Фоновая синхронизация не поддерживается', 'warning');
            }
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            this.showNotification('Ошибка синхронизации', 'error');
        }
    }

    updateOnlineStatus(isOnline) {
        if (isOnline) {
            this.showNotification('Соединение восстановлено', 'success');
        } else {
            this.showNotification('Работаем в оффлайн режиме', 'warning');
        }
    }

    // IndexedDB методы
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EstimatorDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                
                // Создаем хранилище для смет
                if (!db.objectStoreNames.contains('estimates')) {
                    const store = db.createObjectStore('estimates', { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Создаем хранилище для шаблонов
                if (!db.objectStoreNames.contains('templates')) {
                    const store = db.createObjectStore('templates', { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Создаем хранилище для позиций и категорий
                if (!db.objectStoreNames.contains('items')) {
                    const store = db.createObjectStore('items', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('isActive', 'isActive', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                
                // Миграция с версии 1 на 2
                if (oldVersion < 2) {
                    // Добавляем новые индексы если нужно
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

    // Экспорт/импорт данных
    async exportAllData() {
        try {
            const db = await this.openDB();
            
            // Экспорт всех данных
            const [estimates, templates, items] = await Promise.all([
                this.getAllFromStore(db, 'estimates'),
                this.getAllFromStore(db, 'templates'),
                this.getAllFromStore(db, 'items')
            ]);
            
            const allData = {
                version: '1.0.0',
                exportedAt: new Date().toISOString(),
                estimates,
                templates,
                items
            };
            
            const blob = new Blob(
                [JSON.stringify(allData, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `estimator_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Все данные экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта данных:', error);
            this.showNotification('Ошибка экспорта данных', 'error');
        }
    }

    async exportDataToJSON() {
        try {
            const db = await this.openDB();
            const estimates = await this.getAllFromStore(db, 'estimates');
            
            const blob = new Blob(
                [JSON.stringify(estimates, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `estimates_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Сметы экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    async exportItemsToJSON() {
        try {
            const db = await this.openDB();
            const items = await this.getAllFromStore(db, 'items');
            
            // Фильтруем только активные позиции (не категории)
            const activeItems = items.filter(item => item.isActive !== false && item.type !== 'category');
            
            const blob = new Blob(
                [JSON.stringify(activeItems, null, 2)], 
                { type: 'application/json' }
            );
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `items_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 100);
            
            this.showNotification('Позиции экспортированы', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта позиций:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    async importDataFromJSON(event) {
        if (!confirm('Импортировать данные? Существующие сметы будут сохранены.')) {
            return;
        }
        
        try {
            const file = event.target.files[0];
            if (!file) {
                this.showNotification('Файл не выбран', 'warning');
                return;
            }
            
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!Array.isArray(data)) {
                throw new Error('Некорректный формат данных');
            }
            
            // Определяем тип данных
            if (data.length > 0) {
                const firstItem = data[0];
                
                if (firstItem.items && firstItem.name && firstItem.object) {
                    // Это сметы
                    await this.importEstimates(data);
                    this.showNotification('Сметы импортированы', 'success');
                } else if (firstItem.name && firstItem.unit && firstItem.price !== undefined) {
                    // Это позиции
                    await this.importItems(data);
                    this.showNotification('Позиции импортированы', 'success');
                } else {
                    throw new Error('Неизвестный формат данных');
                }
            }
            
            // Перезагружаем данные
            await this.loadData();
            
        } catch (error) {
            console.error('Ошибка импорта:', error);
            this.showNotification(`Ошибка импорта: ${error.message}`, 'error');
        }
    }

    async importItemsFromJSON(event) {
        if (!confirm('Импортировать позиции? Существующие данные будут сохранены.')) {
            return;
        }
        
        try {
            await this.importDataFromJSON(event);
        } catch (error) {
            console.error('Ошибка импорта позиций:', error);
        }
    }

    async importEstimates(estimates) {
        const db = await this.openDB();
        const transaction = db.transaction(['estimates'], 'readwrite');
        const store = transaction.objectStore('estimates');
        
        for (const estimate of estimates) {
            const newEstimate = {
                ...estimate,
                id: estimate.id || this.generateId(),
                createdAt: estimate.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Обновляем ID для всех позиций в смете
            if (newEstimate.items && Array.isArray(newEstimate.items)) {
                newEstimate.items = newEstimate.items.map(item => ({
                    ...item,
                    id: item.id || this.generateId()
                }));
            }
            
            await store.put(newEstimate);
        }
        
        this.estimates = await this.getAllFromStore(db, 'estimates');
    }

    async importItems(items) {
        const db = await this.openDB();
        const transaction = db.transaction(['items'], 'readwrite');
        const store = transaction.objectStore('items');
        
        for (const item of items) {
            const newItem = {
                ...item,
                id: item.id || this.generateId(),
                type: item.type || 'item',
                isActive: item.isActive !== false,
                createdAt: item.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await store.put(newItem);
        }
        
        this.items = await this.getAllFromStore(db, 'items');
    }

    async resetToFactoryDefaults() {
        if (!confirm('Восстановить заводские настройки? Все ваши изменения в позициях будут потеряны.')) {
            return;
        }
        
        try {
            // Очищаем базу данных позиций
            const db = await this.openDB();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            await store.clear();
            
            // Создаем новые данные
            await this.createDefaultData(db);
            
            // Обновляем данные
            await this.loadData();
            
            this.showNotification('Данные восстановлены к заводским', 'success');
            
        } catch (error) {
            console.error('Ошибка сброса:', error);
            this.showNotification('Ошибка сброса данных', 'error');
        }
    }

    showExcelImportModal() {
        this.showNotification('Функция в разработке', 'info');
    }

    async loadTemplates() {
        console.log('Загрузка шаблонов...');
    }

    async loadItemsManager() {
        console.log('Загрузка менеджера позиций...');
    }

    showTemplatesModal() {
        this.showNotification('Функция в разработке', 'info');
    }
}

// Инициализация приложения при загрузке
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new EstimatorApp();
    window.app = app; // Делаем глобально доступным для обработчиков
});

// Регистрация Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker зарегистрирован:', registration);
                
                // Проверяем обновления каждые 60 минут
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000);
            })
            .catch(error => {
                console.log('Ошибка регистрации ServiceWorker:', error);
            });
    });
}
