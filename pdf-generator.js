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

    async generateEstimatePDF(estimate) {
        // Создаем новый PDF документ
        this.doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // Добавляем заголовок
        this.addHeader(estimate);
        
        // Добавляем информацию о клиенте
        this.addClientInfo(estimate);
        
        // Добавляем таблицу с позициями
        this.addItemsTable(estimate);
        
        // Добавляем итоги
        this.addTotals(estimate);
        
        // Добавляем условия оплаты
        this.addPaymentTerms(estimate);
        
        // Добавляем подписи
        this.addSignatures();
        
        // Добавляем нумерацию страниц
        this.addPageNumbers();
        
        return this.doc;
    }

    addHeader(estimate) {
        // Логотип компании (можно заменить на реальное изображение)
        this.doc.setFontSize(20);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('PotolokForLife', this.margin, 15);
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text('Натяжные потолки на всю жизнь', this.margin, 22);
        this.doc.text('Пушкино', this.margin, 27);
        this.doc.text('8(977)531-10-99, 8(977)709-38-43', this.margin, 32);
        
        // Заголовок документа
        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', this.pageWidth / 2, 45, { align: 'center' });
        
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`№ ${estimate.id}`, this.pageWidth / 2, 52, { align: 'center' });
        this.doc.text(`от ${new Date(estimate.date).toLocaleDateString('ru-RU')}`, this.pageWidth / 2, 57, { align: 'center' });
        
        this.currentY = 65;
    }

    addClientInfo(estimate) {
        this.doc.setFontSize(12);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Клиент:', this.margin, this.currentY);
        
        this.doc.setFont('helvetica', 'normal');
        this.currentY += 7;
        this.doc.text(`Объект: ${estimate.object}`, this.margin, this.currentY);
        
        this.currentY += 7;
        this.doc.text(`Адрес: ${estimate.address}`, this.margin, this.currentY);
        
        if (estimate.rooms) {
            this.currentY += 7;
            this.doc.text(`Количество помещений: ${estimate.rooms}`, this.margin, this.currentY);
        }
        
        if (estimate.area || estimate.perimeter || estimate.height) {
            this.currentY += 7;
            let metrics = [];
            if (estimate.area) metrics.push(`Площадь: ${estimate.area} м²`);
            if (estimate.perimeter) metrics.push(`Периметр: ${estimate.perimeter} м`);
            if (estimate.height) metrics.push(`Высота: ${estimate.height} м`);
            this.doc.text(`Параметры: ${metrics.join(', ')}`, this.margin, this.currentY);
        }
        
        this.currentY += 15;
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
            item.quantity.toFixed(2),
            this.formatCurrency(item.price),
            this.formatCurrency(item.quantity * item.price)
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

    addPaymentTerms(estimate) {
        this.doc.setFontSize(11);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Условия оплаты:', this.margin, this.currentY);
        
        this.currentY += 7;
        this.doc.setFont('helvetica', 'normal');
        
        const paymentTerms = estimate.paymentDetails || 
            `1. Предоплата 50% не позднее 3-х дней до планируемой даты выполнения монтажа 1-го этапа.
2. Окончательный расчет 50% в день завершения всех работ.
Оплата за материалы производится 100% до начала выполнения работ.`;
        
        const lines = this.doc.splitTextToSize(paymentTerms, this.pageWidth - 2 * this.margin);
        this.doc.text(lines, this.margin, this.currentY);
        
        this.currentY += lines.length * 7 + 10;
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
export function generateEstimateHTML(estimate) {
    const date = new Date(estimate.date).toLocaleDateString('ru-RU');
    const items = estimate.items || [];
    const subtotal = estimate.total || 0;
    const discount = estimate.discount || 0;
    const discountAmount = subtotal * (discount / 100);
    const finalTotal = subtotal - discountAmount;
    
    return `
        <div class="pdf-preview">
            <div class="pdf-header">
                <h1>PotolokForLife</h1>
                <h2>Натяжные потолки на всю жизнь</h2>
                <p>Пушкино | 8(977)531-10-99, 8(977)709-38-43</p>
                <h3>КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ</h3>
                <p>№ ${estimate.id} от ${date}</p>
            </div>
            
            <div class="pdf-client-info">
                <h4>Клиент:</h4>
                <p><strong>Объект:</strong> ${estimate.object}</p>
                <p><strong>Адрес:</strong> ${estimate.address}</p>
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
                                <td>${item.quantity.toFixed(2)}</td>
                                <td>${item.price.toFixed(2)}</td>
                                <td>${(item.quantity * item.price).toFixed(2)}</td>
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
                <p>${(estimate.paymentDetails || 
                    `1. Предоплата 50% не позднее 3-х дней до планируемой даты выполнения монтажа 1-го этапа.
2. Окончательный расчет 50% в день завершения всех работ.
Оплата за материалы производится 100% до начала выполнения работ.`).replace(/\n/g, '<br>')}</p>
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
                <p>PotolokForLife - Натяжные потолки на всю жизнь | Пушкино | 8(977)531-10-99</p>
            </div>
        </div>
    `;
}

// Основной экспорт
export async function generateEstimatePDF(estimate) {
    const generator = new PDFGenerator();
    return await generator.generateEstimatePDF(estimate);
}
