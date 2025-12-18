// PDF Generator для создания коммерческих предложений
// Используем глобальный jsPDF (загружен через тег script в HTML)

class PDFGenerator {
    constructor() {
        this.doc = null;
        this.margin = 20;
        this.pageWidth = 210; // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.currentY = 0;
    }

    async generateEstimatePDF(estimate, companyData = null) {
        // Проверяем, что jsPDF доступен глобально
        if (typeof window.jsPDF === 'undefined') {
            throw new Error('jsPDF не загружен. Проверьте подключение библиотеки.');
        }
        
        // Создаем новый PDF документ
        this.doc = new window.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Добавляем заголовок
        this.addHeader(estimate, companyData);
        
        // Добавляем информацию о клиенте
        this.addClientInfo(estimate);
        
        // Добавляем таблицу с позициями
        this.addItemsTable(estimate);
        
        // Добавляем итоги
        this.addTotals(estimate);
        
        // Добавляем условия оплаты
        this.addPaymentTerms(estimate, companyData);
        
        // Добавляем подписи
        this.addSignatures();
        
        // Добавляем нумерацию страниц
        this.addPageNumbers();
        
        return this.doc;
    }

    addHeader(estimate, companyData) {
        // Используем данные компании или значения по умолчанию
        const company = companyData?.company || {
            name: 'PotolokForLife',
            fullName: 'Натяжные потолки на всю жизнь',
            address: 'Московская область, г. Пушкино',
            phone: '8(977)531-10-99',
            additionalPhone: '8(977)709-38-43',
            email: 'potolokforlife@yandex.ru'
        };

        // Логотип компании
        this.doc.setFontSize(20);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(company.name, this.margin, 15);
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(company.fullName, this.margin, 22);
        
        if (company.address) {
            this.doc.text(company.address, this.margin, 27);
        }
        
        let contactY = 32;
        if (company.phone) {
            this.doc.text(`Тел: ${company.phone}`, this.margin, contactY);
            contactY += 5;
        }
        
        if (company.additionalPhone) {
            this.doc.text(`Доп. тел: ${company.additionalPhone}`, this.margin, contactY);
            contactY += 5;
        }
        
        if (company.email) {
            this.doc.text(`Email: ${company.email}`, this.margin, contactY);
        }
        
        // Заголовок документа
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', this.pageWidth / 2, 50, { align: 'center' });
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`№ ${estimate.id}`, this.pageWidth / 2, 57, { align: 'center' });
        
        const date = estimate.date ? new Date(estimate.date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU');
        this.doc.text(`от ${date}`, this.pageWidth / 2, 62, { align: 'center' });
        
        this.currentY = 70;
    }

    addClientInfo(estimate) {
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Клиент:', this.margin, this.currentY);
        
        this.doc.setFont('helvetica', 'normal');
        this.currentY += 7;
        
        if (estimate.object) {
            this.doc.text(`Объект: ${estimate.object}`, this.margin, this.currentY);
            this.currentY += 7;
        }
        
        if (estimate.address) {
            this.doc.text(`Адрес: ${estimate.address}`, this.margin, this.currentY);
            this.currentY += 7;
        }
        
        if (estimate.rooms) {
            this.doc.text(`Количество помещений: ${estimate.rooms}`, this.margin, this.currentY);
            this.currentY += 7;
        }
        
        const metrics = [];
        if (estimate.area) metrics.push(`Площадь: ${estimate.area} м²`);
        if (estimate.perimeter) metrics.push(`Периметр: ${estimate.perimeter} м`);
        if (estimate.height) metrics.push(`Высота: ${estimate.height} м`);
        
        if (metrics.length > 0) {
            this.doc.text(`Параметры: ${metrics.join(', ')}`, this.margin, this.currentY);
            this.currentY += 7;
        }
        
        this.currentY += 10;
    }

    addItemsTable(estimate) {
        const items = estimate.items || [];
        
        if (items.length === 0) {
            this.doc.setFont('helvetica', 'italic');
            this.doc.text('Нет позиций в смете', this.margin, this.currentY);
            this.currentY += 10;
            return;
        }
        
        // Подготавливаем данные для таблицы
        const tableData = items.map((item, index) => [
            index + 1,
            item.name,
            item.unit,
            (item.quantity || 0).toFixed(2),
            this.formatCurrency(item.price || 0),
            this.formatCurrency((item.quantity || 0) * (item.price || 0))
        ]);
        
        // Добавляем заголовок таблицы
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Смета работ и материалов:', this.margin, this.currentY);
        this.currentY += 5;
        
        // Проверяем наличие jsPDF AutoTable
        if (typeof this.doc.autoTable !== 'function') {
            // Простая таблица без AutoTable
            this.addSimpleTable(items);
            return;
        }
        
        // Создаем таблицу с AutoTable
        this.doc.autoTable({
            startY: this.currentY,
            head: [['№', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена, руб.', 'Сумма, руб.']],
            body: tableData,
            margin: { left: this.margin, right: this.margin },
            styles: {
                fontSize: 10,
                cellPadding: 3,
                overflow: 'linebreak',
                cellWidth: 'auto'
            },
            headStyles: {
                fillColor: [79, 70, 229],
                textColor: 255,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 15 },
                1: { cellWidth: 80 },
                2: { cellWidth: 25 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30 },
                5: { cellWidth: 30 }
            },
            didDrawPage: (data) => {
                this.currentY = data.cursor.y;
            }
        });
        
        this.currentY += 5;
    }

    addSimpleTable(items) {
        // Простая реализация таблицы без AutoTable
        let y = this.currentY;
        const colWidths = [15, 80, 25, 25, 30, 30];
        const startX = this.margin;
        
        // Заголовок таблицы
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        const headers = ['№', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена', 'Сумма'];
        
        headers.forEach((header, i) => {
            let x = startX;
            for (let j = 0; j < i; j++) {
                x += colWidths[j];
            }
            this.doc.text(header, x, y);
        });
        
        y += 7;
        
        // Данные таблицы
        this.doc.setFont('helvetica', 'normal');
        items.forEach((item, index) => {
            const row = [
                (index + 1).toString(),
                item.name.substring(0, 30) + (item.name.length > 30 ? '...' : ''),
                item.unit,
                (item.quantity || 0).toFixed(2),
                this.formatCurrency(item.price || 0),
                this.formatCurrency((item.quantity || 0) * (item.price || 0))
            ];
            
            row.forEach((cell, i) => {
                let x = startX;
                for (let j = 0; j < i; j++) {
                    x += colWidths[j];
                }
                this.doc.text(cell, x, y);
            });
            
            y += 7;
            
            // Проверяем, не вышли ли за пределы страницы
            if (y > this.pageHeight - 30) {
                this.doc.addPage();
                y = this.margin;
            }
        });
        
        this.currentY = y + 10;
    }

    addTotals(estimate) {
        const subtotal = estimate.total || 0;
        const discount = estimate.discount || 0;
        const discountAmount = subtotal * (discount / 100);
        const finalTotal = subtotal - discountAmount;
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        
        // Итоги
        const totalsX = this.pageWidth - this.margin - 80;
        
        this.doc.text('Сумма:', totalsX, this.currentY);
        this.doc.text(this.formatCurrency(subtotal), totalsX + 40, this.currentY, { align: 'right' });
        this.currentY += 7;
        
        this.doc.text('Скидка:', totalsX, this.currentY);
        this.doc.text(`${discount}% (${this.formatCurrency(discountAmount)})`, totalsX + 40, this.currentY, { align: 'right' });
        this.currentY += 7;
        
        this.doc.text('ИТОГО К ОПЛАТЕ:', totalsX, this.currentY);
        this.doc.text(this.formatCurrency(finalTotal), totalsX + 40, this.currentY, { align: 'right' });
        
        this.currentY += 20;
    }

    addPaymentTerms(estimate, companyData) {
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Условия оплаты:', this.margin, this.currentY);
        
        this.currentY += 7;
        this.doc.setFont('helvetica', 'normal');
        
        const paymentTerms = estimate.paymentDetails || 
            (companyData?.payment?.defaultTerms || 
            `1. Предоплата 50% не позднее 3-х дней до планируемой даты выполнения монтажа 1-го этапа.
2. Окончательный расчет 50% в день завершения всех работ.
Оплата за материалов производится 100% до начала выполнения работ.`);
        
        const lines = this.doc.splitTextToSize(paymentTerms, this.pageWidth - 2 * this.margin);
        this.doc.text(lines, this.margin, this.currentY);
        
        this.currentY += lines.length * 7 + 5;
        
        // Гарантия
        const warranty = companyData?.payment?.warranty || 'Гарантия 5 лет на материалы и работы';
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Гарантия:', this.margin, this.currentY);
        this.currentY += 7;
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(warranty, this.margin, this.currentY);
        
        this.currentY += 15;
    }

    addSignatures() {
        const lineY = this.pageHeight - 40;
        
        // Подпись исполнителя
        this.doc.setFontSize(10);
        this.doc.text('_________________', this.margin, lineY);
        this.doc.text('Исполнитель', this.margin, lineY + 5);
        
        // Подпись заказчика
        this.doc.text('_________________', this.pageWidth - this.margin - 40, lineY);
        this.doc.text('Заказчик', this.pageWidth - this.margin - 40, lineY + 5);
    }

    addPageNumbers() {
        const totalPages = this.doc.internal.getNumberOfPages();
        
        for (let i = 1; i <= totalPages; i++) {
            this.doc.setPage(i);
            this.doc.setFontSize(10);
            this.doc.text(
                `Страница ${i} из ${totalPages}`,
                this.pageWidth / 2,
                this.pageHeight - 10,
                { align: 'center' }
            );
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

// Функция для генерации HTML предпросмотра
export function generateEstimateHTML(estimate, companyData = null) {
    const date = estimate.date ? new Date(estimate.date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU');
    const items = estimate.items || [];
    const subtotal = estimate.total || 0;
    const discount = estimate.discount || 0;
    const discountAmount = subtotal * (discount / 100);
    const finalTotal = subtotal - discountAmount;
    
    // Данные компании
    const company = companyData?.company || {
        name: 'PotolokForLife',
        fullName: 'Натяжные потолки на всю жизнь',
        address: 'Московская область, г. Пушкино',
        phone: '8(977)531-10-99',
        additionalPhone: '8(977)709-38-43',
        email: 'potolokforlife@yandex.ru'
    };
    
    const paymentTerms = estimate.paymentDetails || 
        (companyData?.payment?.defaultTerms || 
        `1. Предоплата 50% не позднее 3-х дней до планируемой даты выполнения монтажа 1-го этапа.
2. Окончательный расчет 50% в день завершения всех работ.
Оплата за материалов производится 100% до начала выполнения работ.`);
    
    const warranty = companyData?.payment?.warranty || 'Гарантия 5 лет на материалы и работы';
    
    return `
        <div class="pdf-preview" style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: white; color: #333;">
            <div class="pdf-header" style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px;">
                <h1 style="color: #4f46e5; margin-bottom: 10px;">${company.name}</h1>
                <h2 style="color: #666; font-size: 18px; margin-bottom: 10px;">${company.fullName}</h2>
                ${company.address ? `<p style="color: #666;">${company.address}</p>` : ''}
                ${company.phone ? `<p style="color: #666;">Тел: ${company.phone}</p>` : ''}
                ${company.additionalPhone ? `<p style="color: #666;">Доп. тел: ${company.additionalPhone}</p>` : ''}
                ${company.email ? `<p style="color: #666;">Email: ${company.email}</p>` : ''}
                <h3 style="color: #333; margin-top: 20px; font-size: 24px;">КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h3>
                <p style="color: #666;">№ ${estimate.id} от ${date}</p>
            </div>
            
            <div class="pdf-client-info" style="margin-bottom: 30px; padding: 15px; background: #f5f5f5; border-radius: 5px;">
                <h4 style="color: #4f46e5; margin-bottom: 15px;">Клиент:</h4>
                ${estimate.object ? `<p><strong>Объект:</strong> ${estimate.object}</p>` : ''}
                ${estimate.address ? `<p><strong>Адрес:</strong> ${estimate.address}</p>` : ''}
                ${estimate.rooms ? `<p><strong>Помещений:</strong> ${estimate.rooms}</p>` : ''}
                ${estimate.area || estimate.perimeter || estimate.height ? 
                    `<p><strong>Параметры:</strong> ${[
                        estimate.area ? `Площадь: ${estimate.area} м²` : '',
                        estimate.perimeter ? `Периметр: ${estimate.perimeter} м` : '',
                        estimate.height ? `Высота: ${estimate.height} м` : ''
                    ].filter(Boolean).join(', ')}</p>` : ''}
            </div>
            
            <div class="pdf-items" style="margin-bottom: 30px;">
                <h4 style="color: #4f46e5; margin-bottom: 15px;">Смета работ и материалов:</h4>
                <table class="pdf-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #4f46e5; color: white;">
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">№</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Наименование</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Ед.изм.</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Кол-во</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Цена, руб.</th>
                            <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Сумма, руб.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr style="${index % 2 === 0 ? 'background: #f9f9f9;' : ''}">
                                <td style="padding: 10px; border: 1px solid #ddd;">${index + 1}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.name}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${item.unit}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${(item.quantity || 0).toFixed(2)}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${(item.price || 0).toFixed(2)}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="pdf-totals" style="margin-bottom: 30px; text-align: right;">
                <table class="pdf-totals-table" style="width: 300px; margin-left: auto; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Сумма:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${subtotal.toFixed(2)} руб.</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd;"><strong>Скидка:</strong></td>
                        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${discount}% (${discountAmount.toFixed(2)} руб.)</td>
                    </tr>
                    <tr style="background: #f0f0f0;">
                        <td style="padding: 10px;"><strong>ИТОГО К ОПЛАТЕ:</strong></td>
                        <td style="padding: 10px; text-align: right; font-size: 18px;"><strong>${finalTotal.toFixed(2)} руб.</strong></td>
                    </tr>
                </table>
            </div>
            
            <div class="pdf-payment" style="margin-bottom: 40px; padding: 20px; background: #f5f5f5; border-radius: 5px;">
                <h4 style="color: #4f46e5; margin-bottom: 10px;">Условия оплаты:</h4>
                <p style="white-space: pre-line; margin-bottom: 20px;">${paymentTerms}</p>
                
                <h4 style="color: #4f46e5; margin-bottom: 10px;">Гарантия:</h4>
                <p>${warranty}</p>
            </div>
            
            <div class="pdf-signatures" style="display: flex; justify-content: space-between; margin-top: 60px;">
                <div class="pdf-signature" style="width: 200px;">
                    <div style="border-bottom: 1px solid #333; height: 1px; margin-bottom: 5px;"></div>
                    <p style="text-align: center; margin-top: 5px;">Исполнитель</p>
                </div>
                <div class="pdf-signature" style="width: 200px;">
                    <div style="border-bottom: 1px solid #333; height: 1px; margin-bottom: 5px;"></div>
                    <p style="text-align: center; margin-top: 5px;">Заказчик</p>
                </div>
            </div>
            
            <div class="pdf-footer" style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 14px;">
                <p>${company.name} - ${company.fullName} | ${company.address || ''} | ${company.phone || ''}</p>
            </div>
        </div>
    `;
}

// Основной экспорт
export async function generateEstimatePDF(estimate, companyData = null) {
    const generator = new PDFGenerator();
    return await generator.generateEstimatePDF(estimate, companyData);
}
