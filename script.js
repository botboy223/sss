const USERNAME = "user123";
const PASSWORD = "pass123";

let products = JSON.parse(localStorage.getItem("products")) || {};  // Store all products with barcode as key
let cart = [];  // Products added to the cart with quantities
let history = JSON.parse(localStorage.getItem("history")) || [];  // Store bill history

function domReady(fn) {
    document.readyState === "complete" || document.readyState === "interactive"
        ? setTimeout(fn, 1)
        : document.addEventListener("DOMContentLoaded", fn);
}

domReady(function () {
    function onScanSuccess(decodedText) {
        if (products[decodedText]) {
            let quantity = prompt(`Scanned Product: ${products[decodedText].name}\nPlease enter the quantity:`);
            if (quantity && quantity > 0) {
                cart.push({
                    ...products[decodedText],
                    quantity: parseInt(quantity)
                });
                displayCart();
            } else {
                alert("Invalid quantity. Please try again.");
            }
        } else {
            let productDetails = prompt(`New Product: ${decodedText}\nEnter details (name,price,expiry) separated by commas:`);
            if (productDetails) {
                let [name, price, expiry] = productDetails.split(",");
                if (name && !isNaN(price) && expiry) {
                    products[decodedText] = { barcode: decodedText, name, price: parseFloat(price), expiry };
                    localStorage.setItem("products", JSON.stringify(products));

                    let quantity = prompt(`Product ${name} added.\nPlease enter the quantity:`);
                    if (quantity && quantity > 0) {
                        cart.push({
                            ...products[decodedText],
                            quantity: parseInt(quantity)
                        });
                        displayCart();
                    } else {
                        alert("Invalid quantity. Please try again.");
                    }
                } else {
                    alert("Invalid product details. Please enter name, price, and expiry correctly.");
                }
            }
        }
    }

    let htmlScanner = new Html5QrcodeScanner("my-qr-reader", { fps: 10, qrbox: 250 });
    htmlScanner.render(onScanSuccess);
});

function login() {
    let username = document.getElementById("username").value;
    let password = document.getElementById("password").value;
    let loginError = document.getElementById("login-error");

    if (username === USERNAME && password === PASSWORD) {
        alert("Login successful!");
        document.getElementById("login-section").style.display = "none";
        document.getElementById("scanner-section").style.display = "block";
        document.getElementById("view-history").classList.remove("hidden");
    } else {
        loginError.textContent = "Invalid credentials!";
    }
}

function displayCart() {
    let productList = document.getElementById("product-list");
    productList.innerHTML = "";
    cart.forEach((product, index) => {
        productList.innerHTML += `
            <div>
                <span>Product: ${product.name} | Price: ₹${product.price} | Quantity: ${product.quantity} | Expiry: ${product.expiry}</span>
                <button onclick="removeFromCart(${index})">Remove</button>
            </div>`;
    });
}

function removeFromCart(index) {
    cart.splice(index, 1);
    displayCart();
}

function generateBill() {
    let total = cart.reduce((sum, product) => sum + (product.price * product.quantity), 0);
    let bill = {
        products: [...cart],
        total,
        time: new Date().toLocaleString(),
    };
    history.push(bill);
    localStorage.setItem("history", JSON.stringify(history));

    let billSection = document.getElementById("bill-section");
    billSection.style.display = "block";
    billSection.innerHTML = `<h3>Bill Generated</h3>`;
    billSection.innerHTML += `<div>Total: ₹${total}</div>`;
    billSection.innerHTML += `<div>Date: ${bill.time}</div>`;
    bill.products.forEach((product) => {
        billSection.innerHTML += `
            <div>Product: ${product.name} | Price: ₹${product.price} | Quantity: ${product.quantity} | Subtotal: ₹${product.price * product.quantity}</div>`;
    });

    let printBtn = document.createElement("button");
    printBtn.innerText = "Print Bill";
    printBtn.onclick = () => printBill(bill);
    billSection.appendChild(printBtn);

    cart = [];
    document.getElementById("product-list").innerHTML = "";
}

function printBill(bill) {
    let printWindow = window.open('', '_blank');
    let printContent = `
        <html>
            <head>
                <title>Bill</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h3 { margin-bottom: 10px; }
                    div { margin: 5px 0; }
                </style>
            </head>
            <body>
                <h3>Bill</h3>
                <div>Date: ${bill.time}</div>
                <div>Total: ₹${bill.total}</div>
                <hr>
                ${bill.products
                    .map(
                        (product) =>
                            `<div>Product: ${product.name} | Price: ₹${product.price} | Quantity: ${product.quantity} | Subtotal: ₹${product.price * product.quantity}</div>`
                    )
                    .join('')}
                <hr>
                <p>Thank you for your purchase!</p>
            </body>
        </html>`;
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function viewHistory() {
    let historySection = document.getElementById("history-section");
    historySection.style.display = "block";
    historySection.innerHTML = `<h3>Bill History</h3>`;
    history.forEach((bill, index) => {
        historySection.innerHTML += `<div>Bill ${index + 1} - Total: ₹${bill.total} - Date: ${bill.time}</div>`;
        bill.products.forEach((product) => {
            historySection.innerHTML += `
                <div>Product: ${product.name} | Price: ₹${product.price} | Quantity: ${product.quantity} | Subtotal: ₹${product.price * product.quantity}</div>`;
        });
        historySection.innerHTML += `<hr>`;
    });
}
