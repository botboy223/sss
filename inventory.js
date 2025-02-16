function domReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(fn, 1);
    } else {
        document.addEventListener("DOMContentLoaded", fn);
    }
}

window.jsPDF = window.jspdf.jsPDF;

function saveToLocalStorage(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function loadFromLocalStorage(key) {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
}

domReady(function () {
    let productDetails = loadFromLocalStorage('productDetails') || {};
    let cart = [];
    let upiDetails = loadFromLocalStorage('upiDetails') || {};
    let billHistory = loadFromLocalStorage('billHistory') || [];
    let inventory = loadFromLocalStorage('inventory') || {};

    // Scanner for Option 1 (Product Setup)
    const html5QrcodeScannerOption1 = new Html5QrcodeScanner(
        "my-qr-reader-option1",
        { fps: 30, qrbox: { width: 250, height: 250 } }
    );
    html5QrcodeScannerOption1.render((decodeText) => {
        document.getElementById('barcode').value = decodeText;
        if (productDetails[decodeText]) {
            document.getElementById('product-name').value = productDetails[decodeText].name;
            document.getElementById('product-price').value = productDetails[decodeText].price;
            document.getElementById('product-quantity').value = inventory[decodeText]?.quantity || 0;
        } else {
            document.getElementById('product-name').value = '';
            document.getElementById('product-price').value = '';
            document.getElementById('product-quantity').value = '';
        }
    });

    // Scanner for Option 2 (Cart)
    const html5QrcodeScannerOption2 = new Html5QrcodeScanner(
        "my-qr-reader-option2",
        { fps: 30, qrbox: { width: 250, height: 250 } }
    );
    html5QrcodeScannerOption2.render((decodeText) => {
        if (productDetails[decodeText]) {
            const existingItem = cart.find(item => item.code === decodeText);
            if (!existingItem) {
                if (inventory[decodeText].quantity > 0) { // Check if there's stock
                    cart.push({ code: decodeText, quantity: 1 }); // Start with a quantity of 1
                    displayCart();
                } else {
                    alert(`Out of stock for product ${inventory[decodeText].name}!`);
                }
            } else {
                if (inventory[decodeText].quantity >= existingItem.quantity + 1) { // Check if adding more won't exceed stock
                    existingItem.quantity++;
                    displayCart();
                } else {
                    alert(`Cannot add more. Only ${inventory[decodeText].quantity} left in stock for ${inventory[decodeText].name}.`);
                }
            }
        } else {
            alert(`Product ${decodeText} not found!`);
        }
    });

    // Cart Display
    function displayCart() {
        const cartDiv = document.getElementById('cart');
        cartDiv.innerHTML = '';
        cart.forEach((item, index) => {
            const product = productDetails[item.code];
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <span class="product-name">${product?.name || 'Unknown Product'}</span>
                <span class="product-price">Rs. ${product?.price?.toFixed(2) || '0.00'}</span>
                <input type="number" 
                       value="${item.quantity}" 
                       min="1" 
                       data-index="${index}"
                       class="quantity-input">
                <span class="item-total">Rs. ${(product?.price * item.quantity).toFixed(2) || '0.00'}</span>
            `;
            cartDiv.appendChild(itemDiv);
        });
        calculateTotal();
    }

    function calculateTotal() {
        const total = cart.reduce((sum, item) => {
            const product = productDetails[item.code];
            return sum + (product?.price || 0) * item.quantity;
        }, 0);
        document.getElementById('total').innerHTML = `<strong>Total:</strong> Rs. ${total.toFixed(2)}`;
    }

    // Event Listeners
    document.getElementById('cart').addEventListener('input', (e) => {
        if (e.target.classList.contains('quantity-input')) {
            const index = e.target.dataset.index;
            const newQty = parseInt(e.target.value);
            const productCode = cart[index].code;
            const oldQty = cart[index].quantity;
            
            if (!isNaN(newQty) && newQty > 0) {
                // Check if there's enough stock before changing quantity
                if (inventory[productCode].quantity >= newQty) {
                    cart[index].quantity = newQty;
                    displayCart();
                } else {
                    alert(`Not enough stock. Only ${inventory[productCode].quantity} left.`);
                    e.target.value = oldQty; // Reset to previous value
                }
            } else if (e.target.value === '') {
                // Allow the field to be empty temporarily for editing
                e.target.value = ''; // Keep it empty so user can type a new number
            } else {
                // If input is not a positive number or empty, reset to old quantity
                alert('Quantity must be a positive number.');
                e.target.value = oldQty; // Reset to previous value
            }
        }
    });

    document.getElementById('save-barcode').addEventListener('click', () => {
        const barcode = document.getElementById('barcode').value.trim();
        const name = document.getElementById('product-name').value.trim();
        const price = parseFloat(document.getElementById('product-price').value);
        const quantity = parseInt(document.getElementById('product-quantity').value) || 0;

        if (barcode && name && !isNaN(price) && price > 0) {
            productDetails[barcode] = { name, price };
            inventory[barcode] = { name, price, quantity };
            saveToLocalStorage('productDetails', productDetails);
            saveToLocalStorage('inventory', inventory);
            alert('Product saved successfully!');
        } else {
            alert('Invalid input! Please check all fields.');
        }
    });

    // PDF Generation
    document.getElementById('generate-bill').addEventListener('click', async () => {
        try {
            // Validate UPI details
            if (!upiDetails.upiId || !upiDetails.name || !upiDetails.note) {
                throw new Error('Please configure UPI details first');
            }

            // Calculate total
            const totalAmount = cart.reduce((sum, item) => {
                const product = productDetails[item.code];
                return sum + (product?.price || 0) * item.quantity;
            }, 0);

            // Generate UPI URL
            const upiUrl = `upi://pay?pa=${upiDetails.upiId}` +
                            `&pn=${encodeURIComponent(upiDetails.name)}` +
                            `&am=${totalAmount.toFixed(2)}` +
                            `&cu=INR` +
                            `&tn=${encodeURIComponent(upiDetails.note)}`;

            // Create QR Code
            const qrCode = new QRCodeStyling({
                width: 200,
                height: 200,
                data: upiUrl,
                dotsOptions: {
                    color: "#000",
                    type: "rounded"
                },
                backgroundOptions: {
                    color: "#ffffff"
                }
            });

            // Render QR Code
            const qrContainer = document.getElementById('bill-qr-code');
            qrContainer.innerHTML = '';
            qrCode.append(qrContainer);

            // Wait for QR code rendering
            await new Promise(resolve => setTimeout(resolve, 500));

            // Create PDF
            const doc = new jsPDF();
            let yPos = 20;

            // Header
            doc.setFontSize(22);
            doc.text("INVOICE", 105, yPos, { align: 'center' });
            yPos += 15;

            // Invoice Details
            doc.setFontSize(12);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos);
            doc.text(`Time: ${new Date().toLocaleTimeString()}`, 160, yPos);
            yPos += 15;

            // Table Header
            doc.setFillColor(240, 240, 240);
            doc.rect(20, yPos, 170, 10, 'F');
            doc.setFontSize(12);
            doc.text("Item", 22, yPos + 7);
            doc.text("Qty", 100, yPos + 7);
            doc.text("Price", 160, yPos + 7);
            yPos += 12;

            // Items
            cart.forEach(item => {
                const product = productDetails[item.code];
                doc.setFontSize(10);
                doc.text(product?.name || 'Unknown Item', 22, yPos);
                doc.text(item.quantity.toString(), 102, yPos);
                doc.text(`Rs. ${(product?.price * item.quantity).toFixed(2)}`, 162, yPos);
                yPos += 8;
            });

            // Total
            yPos += 10;
            doc.setFontSize(14);
            doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 20, yPos);

            // Add QR Code
            const qrCanvas = qrContainer.querySelector('canvas');
            if (qrCanvas) {
                const qrData = qrCanvas.toDataURL('image/png');
                doc.addImage(qrData, 'PNG', 140, yPos - 10, 50, 50);
            }

            // Save to history
            billHistory.push({
                date: new Date().toLocaleString(),
                total: totalAmount.toFixed(2),
                items: [...cart]
            });
            saveToLocalStorage('billHistory', billHistory);

            // Update inventory and save changes after bill generation
            cart.forEach(item => {
                updateInventory(item.code, item.quantity);
            });
            
            // Clear cart
            cart = [];
            displayCart();
            updateDashboard();

            // Open PDF
            const pdfBlob = doc.output('blob');
            window.open(URL.createObjectURL(pdfBlob), '_blank');

        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error(error);
        }
    });

    // UPI Form Handler
    document.getElementById('qrForm').addEventListener('submit', (e) => {
        e.preventDefault();
        upiDetails = {
            upiId: document.getElementById('upi_id').value.trim(),
            name: document.getElementById('name').value.trim(),
            note: document.getElementById('note').value.trim()
        };
        saveToLocalStorage('upiDetails', upiDetails);
        alert('UPI details saved!');
    });

    // Import/Export Handlers
    document.getElementById('download-data').addEventListener('click', () => {
        const data = {
            productDetails,
            upiDetails,
            billHistory,
            inventory
        };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'qr-app-data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    document.getElementById('upload-data').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    productDetails = data.productDetails || {};
                    upiDetails = data.upiDetails || {};
                    billHistory = data.billHistory || {};
                    inventory = data.inventory || {};
                    saveToLocalStorage('productDetails', productDetails);
                    saveToLocalStorage('upiDetails', upiDetails);
                    saveToLocalStorage('billHistory', billHistory);
                    saveToLocalStorage('inventory', inventory);
                    alert('Data imported successfully!');
                } catch (error) {
                    alert('Invalid file format!');
                }
            };
            reader.readAsText(file);
        }
    });

    // Bill History Display
    document.getElementById('option5-button').addEventListener('click', () => {
        const historyContainer = document.getElementById('bill-history');
        historyContainer.innerHTML = '';
        
        billHistory.forEach((bill, index) => {
            const billElement = document.createElement('div');
            billElement.className = 'bill-entry';
            billElement.innerHTML = `
                <h3>Bill #${index + 1}</h3>
                <p>Date: ${bill.date}</p>
                <ul>
                    ${bill.items.map(item => `
                        <li>${productDetails[item.code]?.name || 'Unknown'} 
                        (x${item.quantity}) - Rs. ${(productDetails[item.code]?.price * item.quantity).toFixed(2)}</li>
                    `).join('')}
                </ul>
                <p>Total: Rs. ${bill.total}</p>
                <hr>
            `;
            historyContainer.appendChild(billElement);
        });
    });

    // Inventory Management
    function updateInventory(barcode, quantityChange) {
        if (inventory[barcode]) {
            inventory[barcode].quantity -= quantityChange;
            if (inventory[barcode].quantity < 0) {
                inventory[barcode].quantity = 0; // Ensure no negative stock
            }
            saveToLocalStorage('inventory', inventory);
        }
    }

    function displayInventory() {
        const inventoryList = document.getElementById('inventory-list');
        inventoryList.innerHTML = '';
        for (const [barcode, data] of Object.entries(inventory)) {
            const item = document.createElement('div');
            item.innerHTML = `
                <span>${data.name}</span>
                <span>Price: Rs. ${data.price.toFixed(2)}</span>
                <span>Quantity: <input type="number" value="${data.quantity}" data-barcode="${barcode}" class="edit-quantity"></span>
                <button data-barcode="${barcode}" class="edit-product">Edit</button>
            `;
            inventoryList.appendChild(item);
        }

        // Event listeners for editing quantity:
        document.querySelectorAll('.edit-quantity').forEach(input => {
            input.addEventListener('change', function() {
                const barcode = this.getAttribute('data-barcode');
                const newQuantity = parseInt(this.value);
                if (newQuantity >= 0) { // Ensure quantity isn't negative
                    inventory[barcode].quantity = newQuantity;
                    document.getElementById('save-inventory').style.display = 'block'; // Show save button
                } else {
                    alert('Quantity cannot be negative!');
                    this.value = inventory[barcode].quantity; // Reset to previous value
                }
            });
        });

        // Event listener for editing product details
        document.querySelectorAll('.edit-product').forEach(button => {
            button.addEventListener('click', function() {
                const barcode = this.getAttribute('data-barcode');
                const product = inventory[barcode];
                document.getElementById('barcode').value = barcode;
                document.getElementById('product-name').value = product.name;
                document.getElementById('product-price').value = product.price;
                document.getElementById('product-quantity').value = product.quantity;
                switchToOption1(); // Switch to Set Barcode Values to allow editing
                document.getElementById('save-inventory').style.display = 'block'; // Show save button
            });
        });

        // Save button event listener
        document.getElementById('save-inventory').addEventListener('click', function() {
            saveToLocalStorage('inventory', inventory);
            this.style.display = 'none'; // Hide save button after saving
            alert('Inventory saved!');
            switchToInventory(); // Refresh inventory view
        });
    }

    function updateDashboard() {
        const today = new Date().toDateString();
        let todaySales = 0;
        let totalSales = 0;

        billHistory.forEach(bill => {
            if (new Date(bill.date).toDateString() === today) {
                todaySales += parseFloat(bill.total);
            }
            totalSales += parseFloat(bill.total);
        });

        document.getElementById('today-sales').textContent = todaySales.toFixed(2);
        document.getElementById('total-sales').textContent = totalSales.toFixed(2);

        const lowStockList = document.getElementById('low-stock-items');
        lowStockList.innerHTML = '';
        Object.entries(inventory).filter(([_, item]) => item.quantity <= 5).forEach(([barcode, item]) => {
            const li = document.createElement('li');
            li.textContent = `${item.name} (${item.quantity} left)`;
            lowStockList.appendChild(li);
        });
    }

    // Show/Hide Options
    function showMoreOptions() {
        console.log("More button clicked!");
        document.getElementById('moreOptions').classList.toggle('hidden');
        updateDashboard();
    }

    function switchToOption1() {
        hideAllOptions();
        document.getElementById('option1').style.display = 'block';
    }

    function switchToOption2() {
        hideAllOptions();
        document.getElementById('option2').style.display = 'block';
    }

    function switchToOption3() {
        hideAllOptions();
        document.getElementById('option3').style.display = 'block';
    }

    function switchToOption4() {
        hideAllOptions();
        document.getElementById('option4').style.display = 'block';
    }

    function switchToOption5() {
        hideAllOptions();
        document.getElementById('option5').style.display = 'block';
    }

    function switchToInventory() {
        hideAllOptions();
        document.getElementById('inventory-option').style.display = 'block';
        displayInventory();
    }

    function hideAllOptions() {
        document.querySelectorAll('.option').forEach(option => option.style.display = 'none');
        document.getElementById('dashboard').classList.remove('hidden');
    }

    // Event listeners for all buttons
    let moreButton = document.getElementById('moreButton');
    if (moreButton) {
        moreButton.removeEventListener('click', showMoreOptions); // Remove existing listener if any
        moreButton.addEventListener('click', showMoreOptions);
        moreButton.addEventListener('touchstart', showMoreOptions);
    }

    document.getElementById('option1-button').addEventListener('click', switchToOption1);
    document.getElementById('option2-button').addEventListener('click', switchToOption2);
    document.getElementById('option3-button').addEventListener('click', switchToOption3);
    document.getElementById('option4-button').addEventListener('click', switchToOption4);
    document.getElementById('option5-button').addEventListener('click', switchToOption5);
    document.getElementById('inventory-button').addEventListener('click', switchToInventory);

    // Initial setup
    switchToOption2(); // Default to cart view
    updateDashboard();
});
