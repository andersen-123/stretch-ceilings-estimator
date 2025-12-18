// PDF Generator для создания коммерческих предложений
import { jsPDF } from 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
import 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js';

class PDFGenerator {
    constructor() {
        this.doc = null;
        this.margin = 20;
        this.pageWidth = 210; // A4 width in mm
        this.pageHeight = 297; // A4 height in mm
        this.currentY = 0;
    }

    async generateEstimatePDF(estimate, companyData = null) {
        // Создаем новый PDF документ
        this.doc = new jsPDF({
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

        // Логотип компании (можно заменить на реальное изображение)
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
        
        // Создаем таблицу
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
                fillColor: [79, 70, 229], // primary color
                textColor: 255,
                fontStyle: 'bold'
            },
            columnStyles: {
                0: { cellWidth: 15 }, // №
                1: { cellWidth: 80 }, // Наименование
                2: { cellWidth: 25 }, // Ед.изм.
                3: { cellWidth: 25 }, // Кол-во
                4: { cellWidth: 30 }, // Цена
                5: { cellWidth: 30 }  // Сумма
            },
            didDrawPage: (data) => {
                this.currentY = data.cursor.y;
            }
        });
        
        this.currentY += 5;
    }

    addTotals(estimate) {
        const subtotal = estimate.total || 0;
        const discount = estimate.discount || 0;
        const discountAmount = subtotal * (discount / 100);
        const finalTotal = subtotal - discountAmount;
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        
        // Итоговая таблица
        const totalsData = [
            ['Сумма:', this.formatCurrency(subtotal)],
            ['Скидка:', `${discount}% (${this.formatCurrency(discountAmount)})`],
            ['ИТОГО К ОПЛАТЕ:', this.formatCurrency(finalTotal)]
        ];
        
        this.doc.autoTable({
            startY: this.currentY,
            body: totalsData,
            margin: { left: this.pageWidth - 100, right: this.margin },
            tableWidth: 80,
            styles: {
                fontSize: 12,
                cellPadding: 5
            },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 60 },
                1: { fontStyle: 'bold', cellWidth: 40, halign: 'right' }
            },
            theme: 'grid',
            didDrawPage: (data) => {
                this.currentY = data.cursor.y;
            }
        });
        
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
Оплата за материалы производится 100% до начала выполнения работ.`);
        
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
Оплата за материалы производится 100% до начала выполнения работ.`);
    
    const warranty = companyData?.payment?.warranty || 'Гарантия 5 лет на материалы и работы';
    
    return `
        <div class="pdf-preview">
            <div class="pdf-header">
                <h1>${company.name}</h1>
                <h2>${company.fullName}</h2>
                ${company.address ? `<p>${company.address}</p>` : ''}
                ${company.phone ? `<p>Тел: ${company.phone}</p>` : ''}
                ${company.additionalPhone ? `<p>Доп. тел: ${company.additionalPhone}</p>` : ''}
                ${company.email ? `<p>Email: ${company.email}</p>` : ''}
                <h3>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h3>
                <p>№ ${estimate.id} от ${date}</p>
            </div>
            
            <div class="pdf-client-info">
                <h4>Клиент:</h4>
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
            
            <div class="pdf-items">
                <h4>Смета работ и материалов:</h4>
                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>Наименование</th>
                            <th>Ед.изм.</th>
                            <th>Кол-во</th>
                            <th>Цена, руб.</th>
                            <th>Сумма, руб.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map((item, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${item.name}</td>
                                <td>${item.unit}</td>
                                <td>${(item.quantity || 0).toFixed(2)}</td>
                                <td>${(item.price || 0).toFixed(2)}</td>
                                <td>${((item.quantity || 0) * (item.price || 0)).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="pdf-totals">
                <table class="pdf-totals-table">
                    <tr>
                        <td><strong>Сумма:</strong></td>
                        <td>${subtotal.toFixed(2)} руб.</td>
                    </tr>
                    <tr>
                        <td><strong>Скидка:</strong></td>
                        <td>${discount}% (${discountAmount.toFixed(2)} руб.)</td>
                    </tr>
                    <tr>
                        <td><strong>ИТОГО К ОПЛАТЕ:</strong></td>
                        <td><strong>${finalTotal.toFixed(2)} руб.</strong></td>
                    </tr>
                </table>
            </div>
            
            <div class="pdf-payment">
                <h4>Условия оплаты:</h4>
                <p>${paymentTerms.replace(/\n/g, '<br>')}</p>
                
                <h4>Гарантия:</h4>
                <p>${warranty}</p>
            </div>
            
            <div class="pdf-signatures">
                <div class="pdf-signature">
                    <div class="signature-line"></div>
                    <p>Исполнитель</p>
                </div>
                <div class="pdf-signature">
                    <div class="signature-line"></div>
                    <p>Заказчик</p>
                </div>
            </div>
            
            <div class="pdf-footer">
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
