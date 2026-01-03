// --- CONFIGURATION ---
const scriptURL = 'https://script.google.com/macros/s/AKfycbz6kvy4Wn8dmmXVbcx2gg-PI8D6a30l7x5Z7X6Xn4FwrfycrJ3A403_wm1batb39_8N/exec';

let stream = null;
let flash = false;

// --- AI INITIALIZATION ---
console.log("SMC Smart AI Scanner System Ready");

// --- PARKING LOGIC ---

function updatePrice() {
    const duration = document.getElementById('duration').value;
    let price = 20;
    if (duration == "2") price = 40;
    if (duration == "4") price = 70;
    if (duration == "12") price = 150;
    document.getElementById('priceLabel').innerText = "₹" + price;
}

function processParking() {
    const vehicle = document.getElementById('vehNo').value.toUpperCase(); 
    const duration = document.getElementById('duration').value;
    const amount = document.getElementById('priceLabel').innerText;

    if (vehicle.length < 4) {
        alert("Please enter a valid Vehicle Number");
        return;
    }

    document.getElementById('payBtn').innerText = "Processing...";
    document.getElementById('payBtn').disabled = true;

    setTimeout(() => {
        let expiry = new Date();
        expiry.setHours(expiry.getHours() + parseInt(duration));

        // 1. Show Receipt UI
        document.getElementById('receipt').classList.remove('hidden');
        document.getElementById('recVehicle').innerText = vehicle;
        document.getElementById('recTime').innerText = expiry.toLocaleTimeString();

        // 2. Add Optional Print & Done Buttons
        const receiptDiv = document.getElementById('receipt');
        if (!document.getElementById('printGroup')) {
            const btnGroup = document.createElement('div');
            btnGroup.id = "printGroup";
            btnGroup.className = "mt-4 space-y-3";
            btnGroup.innerHTML = `
                <button onclick="printThermalBill('${vehicle}', '${expiry.toLocaleTimeString()}', '${amount}')" 
                    class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <i class="fas fa-print"></i> Print Bill (Optional)
                </button>
                <button onclick="location.reload()" 
                    class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase active:scale-95 transition-all">
                    Done / Next Vehicle
                </button>
            `;
            receiptDiv.appendChild(btnGroup);
        }

        document.getElementById('payBtn').innerText = "PAID & SAVED";
        
        // 3. Save to Google Sheets
        fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                vehicle: vehicle, 
                expiry: expiry.toISOString(),
                amount: amount 
            })
        });

    }, 1500);
}

// --- MOBILE THERMAL PRINT ENGINE ---
function printThermalBill(veh, exp, amt) {
    const printWindow = window.open('', '_blank');
    const date = new Date().toLocaleDateString();
    
    printWindow.document.write(`
        <html>
            <head><title>Print Receipt</title></head>
            <style>
                body { font-family: monospace; width: 58mm; text-align: center; padding: 0; margin: 0; }
                .header { font-weight: bold; font-size: 1.2em; margin-top: 10px; }
                .divider { border-top: 1px dashed black; margin: 5px 0; }
                .big { font-size: 1.5em; font-weight: bold; margin: 5px 0; }
                @media print { margin: 0; }
            </style>
            <body>
                <div class="header">SMC PARKING</div>
                <div style="font-size: 0.8em;">SURAT MUNICIPAL CORP</div>
                <div class="divider"></div>
                <div style="font-size: 0.8em;">DATE: ${date}</div>
                <div style="margin-top:5px;">VEHICLE NO:</div>
                <div class="big">${veh}</div>
                <div>VALID UNTIL:</div>
                <div class="big">${exp}</div>
                <div class="divider"></div>
                <div class="header">TOTAL PAID: ${amt}</div>
                <div class="divider"></div>
                <div style="font-size: 0.8em; margin-bottom: 20px;">Keep receipt for exit scan.<br>Drive Safely!</div>
            </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// --- HIGH-SPEED CAMERA FUNCTIONS ---

async function openCam() {
    const overlay = document.getElementById('camOverlay');
    overlay.style.display = 'flex';
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        document.getElementById('video').srcObject = stream;
    } catch (err) { 
        alert("Camera Error: Check Permissions"); 
        closeCam(); 
    }
}

function closeCam() {
    if(stream) stream.getTracks().forEach(t => t.stop());
    document.getElementById('camOverlay').style.display = 'none';
    flash = false;
}

async function toggleFlash() {
    const track = stream.getVideoTracks()[0];
    flash = !flash;
    try { await track.applyConstraints({ advanced: [{ torch: flash }] }); } catch(e) {}
}

async function snap() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const btn = document.getElementById('snapBtn');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    btn.innerText = "AI THINKING...";
    btn.disabled = true;

    try {
        // AI Text Recognition
        const result = await Tesseract.recognize(canvas, 'eng');
        
        // Extract alphanumeric only
        let rawText = result.data.text.replace(/[^A-Z0-9]/gi, "").toUpperCase();
        
        // Look for 10 character pattern (Standard Indian Plate)
        let cleanPlate = "";
        const match = rawText.match(/[A-Z0-9]{10}/);
        
        if(match) {
            cleanPlate = match[0];
        } else {
            // Fallback: Use first 10 chars if match not found but text exists
            cleanPlate = rawText.substring(0, 10);
        }

        if(cleanPlate.length >= 4) {
            document.getElementById('vehNo').value = cleanPlate;
            const beep = document.getElementById('beepSound');
            if(beep) beep.play();
            closeCam();
        } else {
            alert("Could not read plate clearly. Move closer.");
        }
    } catch (err) {
        alert("AI Processing Error. Please enter manually.");
    } finally {
        btn.innerText = "SCAN NOW";
        btn.disabled = false;
    }
}