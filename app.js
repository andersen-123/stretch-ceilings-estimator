// Основной модуль приложения
class EstimatorApp {
    constructor() {
        this.currentEstimate = null;
        this.currentPage = 'estimates';
        this.isSidebarOpen = false;
        this.estimates = [];
        this.templates = [];
        this.items = [];
        
        this.init();
    }

    async init() {
        // Инициализация
        await this.loadData();
        this.bindEvents();
        this.setupIndexedDB();
        this.checkInstallPrompt();
        this.hideSplashScreen();
        this.updateStorageInfo();
    }

    bindEvents() {
        // Навигация
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(e.target.dataset.page);
            });
        });

        // Кнопки меню
        document.getElementById('menu-toggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('close-menu').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Создание сметы
        document.getElementById('new-estimate').addEventListener('click', () => this.navigateTo('create'));
        document.getElementById('new-estimate').addEventListener('click', () => this.createNewEstimate());

        // Сохранение сметы
        document.getElementById('save-estimate').addEventListener('click', () => this.saveEstimate());

        // Добавление позиций
        document.getElementById('add-item').addEventListener('click', () => this.showAddItemModal());
        document.getElementById('add-from-template').addEventListener('click', () => this.showTemplatesModal());

        // Экспорт PDF
        document.getElementById('export-pdf').addEventListener('click', () => this.generatePDF());
        document.getElementById('preview-pdf').addEventListener('click', () => this.previewPDF());

        // Поиск и фильтры
        document.getElementById('search-estimates').addEventListener('input', (e) => this.searchEstimates(e.target.value));
        document.getElementById('filter-status').addEventListener('change', () => this.filterEstimates());
        document.getElementById('sort-by').addEventListener('change', () => this.sortEstimates());

        // Синхронизация
        document.getElementById('sync-button').addEventListener('click', () => this.syncData());

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
            document.getElementById('install-btn').style.display = 'block';
            document.getElementById('install-btn').addEventListener('click', () => this.installApp());
        });
    }

    async navigateTo(page) {
        // Закрываем меню на мобильных
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
            document.getElementById('current-page').textContent = pageElement.querySelector('h2').textContent;
            
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
            }
        }
    }

    toggleSidebar(force) {
        const sidebar = document.getElementById('sidebar');
        const app = document.getElementById('app');
        
        if (force !== undefined) {
            this.isSidebarOpen = force;
        } else {
            this.isSidebarOpen = !this.isSidebarOpen;
        }
        
        sidebar.classList.toggle('active', this.isSidebarOpen);
        app.classList.toggle('sidebar-open', this.isSidebarOpen);
    }

    toggleTheme() {
        const isDark = document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.getElementById('theme-toggle').textContent = isDark ? '☀️' : '🌙';
    }

    async loadData() {
        try {
            // Загружаем данные из IndexedDB
            const db = await this.openDB();
            
            // Загружаем сметы
            this.estimates = await this.getAllFromStore(db, 'estimates') || [];
            
            // Загружаем шаблоны
            this.templates = await this.getAllFromStore(db, 'templates') || [];
            
            // Загружаем позиции
            this.items = await this.getAllFromStore(db, 'items') || [];
            
            // Если данных нет, создаем начальные
            if (this.templates.length === 0) {
                await this.createDefaultTemplates();
            }
            
            if (this.items.length === 0) {
                await this.createDefaultItems();
            }
            
            console.log('Данные загружены:', {
                estimates: this.estimates.length,
                templates: this.templates.length,
                items: this.items.length
            });
            
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            this.showNotification('Ошибка загрузки данных', 'error');
        }
    }

    async loadEstimates() {
        const listElement = document.getElementById('estimates-list');
        
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
        const filtered = this.filterEstimates();
        const sorted = this.sortEstimates(filtered);
        
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

    renderEstimateCard(estimate) {
        const date = new Date(estimate.date).toLocaleDateString('ru-RU');
        const statusText = {
            'draft': 'Черновик',
            'sent': 'Отправлено',
            'accepted': 'Принято',
            'completed': 'Завершено'
        }[estimate.status] || 'Черновик';
        
        return `
            <div class="estimate-card" data-id="${estimate.id}">
                <div class="estimate-header">
                    <div>
                        <h3 class="estimate-title">${estimate.name}</h3>
                        <div class="estimate-details">
                            <div>${estimate.object} • ${estimate.address}</div>
                            <div>Создано: ${date}</div>
                        </div>
                    </div>
                    <span class="estimate-status status-${estimate.status}">${statusText}</span>
                </div>
                <div class="estimate-info">
                    <div class="estimate-metrics">
                        <span>Площадь: ${estimate.area || 0} м²</span>
                        <span>Периметр: ${estimate.perimeter || 0} м</span>
                    </div>
                    <div class="estimate-total">
                        <strong>${estimate.total.toLocaleString('ru-RU')} руб.</strong>
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
            finalTotal: 0
        };

        document.getElementById('edit-title').textContent = 'Новая смета';
        this.setupEstimateForm();
    }

    setupEstimateForm() {
        if (!this.currentEstimate) return;

        // Заполняем форму
        document.getElementById('estimate-name').value = this.currentEstimate.name;
        document.getElementById('estimate-object').value = this.currentEstimate.object;
        document.getElementById('estimate-address').value = this.currentEstimate.address;
        document.getElementById('estimate-rooms').value = this.currentEstimate.rooms;
        document.getElementById('estimate-status').value = this.currentEstimate.status;
        document.getElementById('estimate-date').value = this.currentEstimate.date;
        document.getElementById('area-s').value = this.currentEstimate.area;
        document.getElementById('perimeter-p').value = this.currentEstimate.perimeter;
        document.getElementById('height-h').value = this.currentEstimate.height;
        document.getElementById('estimate-notes').value = this.currentEstimate.notes;
        document.getElementById('discount').value = this.currentEstimate.discount || 0;

        // Заполняем таблицу позиций
        this.renderItemsTable();
        this.updateTotals();
    }

    renderItemsTable() {
        const tbody = document.getElementById('items-tbody');
        
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
                    <input type="number" class="item-qty" value="${item.quantity}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'quantity', parseFloat(this.value))">
                </td>
                <td>
                    <input type="number" class="item-price" value="${item.price}" step="0.01" min="0"
                           onchange="app.updateItemField('${item.id}', 'price', parseFloat(this.value))">
                </td>
                <td class="item-total">${(item.quantity * item.price).toFixed(2)}</td>
                <td>
                    <button class="icon-button" onclick="app.removeItem('${item.id}', event)">🗑️</button>
                </td>
            </tr>
        `).join('');
    }

    updateItemField(itemId, field, value) {
        const item = this.currentEstimate.items.find(i => i.id === itemId);
        if (item) {
            item[field] = value;
            item.total = item.quantity * item.price;
            
            // Обновляем отображение
            const row = document.querySelector(`[data-id="${itemId}"]`);
            if (row) {
                row.querySelector('.item-total').textContent = item.total.toFixed(2);
            }
            
            this.updateTotals();
        }
    }

    async saveEstimate() {
        if (!this.currentEstimate) return;

        // Собираем данные из формы
        this.currentEstimate.name = document.getElementById('estimate-name').value;
        this.currentEstimate.object = document.getElementById('estimate-object').value;
        this.currentEstimate.address = document.getElementById('estimate-address').value;
        this.currentEstimate.rooms = parseInt(document.getElementById('estimate-rooms').value) || 1;
        this.currentEstimate.status = document.getElementById('estimate-status').value;
        this.currentEstimate.date = document.getElementById('estimate-date').value;
        this.currentEstimate.area = parseFloat(document.getElementById('area-s').value) || 0;
        this.currentEstimate.perimeter = parseFloat(document.getElementById('perimeter-p').value) || 0;
        this.currentEstimate.height = parseFloat(document.getElementById('height-h').value) || 0;
        this.currentEstimate.notes = document.getElementById('estimate-notes').value;
        this.currentEstimate.discount = parseFloat(document.getElementById('discount').value) || 0;

        // Обновляем итоги
        this.updateTotals();

        // Сохраняем в IndexedDB
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['estimates'], 'readwrite');
            const store = transaction.objectStore('estimates');
            
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
        event.stopPropagation();
        
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
        event.stopPropagation();
        
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
                    status: 'draft'
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

    updateTotals() {
        if (!this.currentEstimate) return;
        
        const items = this.currentEstimate.items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
        const discount = parseFloat(document.getElementById('discount').value) || 0;
        const discountAmount = subtotal * (discount / 100);
        const total = subtotal - discountAmount;
        
        // Обновляем отображение
        document.getElementById('total-amount').textContent = subtotal.toFixed(2);
        document.getElementById('discount-amount').textContent = discountAmount.toFixed(2);
        document.getElementById('final-amount').textContent = total.toFixed(2);
        
        // Обновляем объект сметы
        if (this.currentEstimate) {
            this.currentEstimate.total = subtotal;
            this.currentEstimate.discount = discount;
            this.currentEstimate.finalTotal = total;
        }
    }

    showAddItemModal() {
        const modal = document.getElementById('add-item-modal');
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
                    <input type="text" id="item-category" placeholder="Например: Основные работы">
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
        
        // Сохраняем в базу позиций
        this.saveToItemsDatabase(newItem);
    }

    async saveToItemsDatabase(item) {
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            
            // Проверяем, есть ли уже такая позиция
            const request = store.index('name').get(item.name);
            
            request.onsuccess = () => {
                if (!request.result) {
                    // Сохраняем только если такой позиции еще нет
                    store.put({
                        ...item,
                        isTemplate: true,
                        createdAt: new Date().toISOString()
                    });
                }
            };
            
        } catch (error) {
            console.error('Ошибка сохранения позиции:', error);
        }
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
            // Импортируем PDF генератор
            const { generateEstimatePDF } = await import('./pdf-generator.js');
            
            // Генерируем PDF
            const pdf = await generateEstimatePDF(this.currentEstimate);
            
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
            const html = generateEstimateHTML(this.currentEstimate);
            
            const previewContent = document.getElementById('pdf-preview-content');
            previewContent.innerHTML = html;
            
            this.showModal('pdf-preview-modal');
            
        } catch (error) {
            console.error('Ошибка предпросмотра:', error);
            this.showNotification('Ошибка предпросмотра', 'error');
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
                const pdf = await generateEstimatePDF(estimate);
                
                const fileName = `Смета_${estimate.name}_${new Date().toISOString().split('T')[0]}.pdf`;
                pdf.save(fileName);
                
                this.showNotification('PDF скачан', 'success');
            };
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            this.showNotification('Ошибка экспорта', 'error');
        }
    }

    // Вспомогательные методы
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
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
        
        modal.style.display = 'none';
        overlay.style.display = 'none';
    }

    hideSplashScreen() {
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            const app = document.getElementById('app');
            
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
        }, 1500);
    }

    checkInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Показываем кнопку установки в меню
            const installBtn = document.getElementById('install-btn');
            if (installBtn) {
                installBtn.style.display = 'block';
                installBtn.addEventListener('click', () => this.installApp());
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
                    
                    document.getElementById('storage-used').textContent = usedMB;
                    document.getElementById('storage-total').textContent = totalMB;
                    document.getElementById('storage-fill').style.width = `${percentage}%`;
                });
        }
    }

    async syncData() {
        this.showNotification('Синхронизация...', 'info');
        
        try {
            // Регистрируем синхронизацию
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

    // IndexedDB методы
    openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('EstimatorDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилище для смет
                if (!db.objectStoreNames.contains('estimates')) {
                    const store = db.createObjectStore('estimates', { keyPath: 'id' });
                    store.createIndex('date', 'date', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                }
                
                // Создаем хранилище для шаблонов
                if (!db.objectStoreNames.contains('templates')) {
                    const store = db.createObjectStore('templates', { keyPath: 'id' });
                    store.createIndex('category', 'category', { unique: false });
                }
                
                // Создаем хранилище для позиций
                if (!db.objectStoreNames.contains('items')) {
                    const store = db.createObjectStore('items', { keyPath: 'id' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('category', 'category', { unique: false });
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

    async createDefaultTemplates() {
        const defaultTemplates = [
            {
                id: 'template-garpun',
                name: 'Гарпун (базовый)',
                category: 'Потолки',
                items: [
                    { name: 'Полотно MSD Premium белое матовое с установкой', unit: 'м²', price: 610 },
                    { name: 'Профиль стеновой/потолочный гарпунный с установкой', unit: 'м.п.', price: 310 },
                    { name: 'Вставка по периметру гарпунная', unit: 'м.п.', price: 220 }
                ]
            },
            {
                id: 'template-garpun-plus',
                name: 'Гарпун +10%',
                category: 'Потолки',
                items: [
                    { name: 'Полотно MSD Premium белое матовое с установкой', unit: 'м²', price: 670 },
                    { name: 'Профиль стеновой/потолочный гарпунный с установкой', unit: 'м.п.', price: 340 },
                    { name: 'Вставка по периметру гарпунная', unit: 'м.п.', price: 240 }
                ]
            }
        ];
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['templates'], 'readwrite');
            const store = transaction.objectStore('templates');
            
            for (const template of defaultTemplates) {
                await store.put(template);
            }
            
            this.templates = defaultTemplates;
            
        } catch (error) {
            console.error('Ошибка создания шаблонов:', error);
        }
    }

    async createDefaultItems() {
        const defaultItems = [
            // Основные работы
            { id: 'item-1', name: 'Полотно MSD Premium белое матовое с установкой', unit: 'м²', price: 610, category: 'Основные работы' },
            { id: 'item-2', name: 'Профиль стеновой/потолочный гарпунный с установкой', unit: 'м.п.', price: 310, category: 'Основные работы' },
            { id: 'item-3', name: 'Вставка по периметру гарпунная', unit: 'м.п.', price: 220, category: 'Основные работы' },
            
            // Электромонтажные работы
            { id: 'item-4', name: 'Монтаж закладных под световое оборудование, установка светильников', unit: 'шт.', price: 780, category: 'Электромонтажные работы' },
            { id: 'item-5', name: 'Монтаж закладных под сдвоенное световое оборудование, установка светильников', unit: 'шт.', price: 1350, category: 'Электромонтажные работы' },
            { id: 'item-6', name: 'Монтаж закладных под люстру', unit: 'шт.', price: 1100, category: 'Электромонтажные работы' },
            { id: 'item-7', name: 'Монтаж закладной и установка вентилятора', unit: 'шт.', price: 1300, category: 'Электромонтажные работы' },
            
            // Дополнительные работы
            { id: 'item-8', name: 'Монтаж закладной под потолочный карниз', unit: 'м.п.', price: 650, category: 'Дополнительные работы' },
            { id: 'item-9', name: 'Установка потолочного карниза', unit: 'м.п.', price: 270, category: 'Дополнительные работы' },
            { id: 'item-10', name: 'Установка разделителей', unit: 'м.п.', price: 1700, category: 'Дополнительные работы' }
        ];
        
        try {
            const db = await this.openDB();
            const transaction = db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            
            for (const item of defaultItems) {
                await store.put(item);
            }
            
            this.items = defaultItems;
            
        } catch (error) {
            console.error('Ошибка создания позиций:', error);
        }
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
            })
            .catch(error => {
                console.log('Ошибка регистрации ServiceWorker:', error);
            });
    });
}
