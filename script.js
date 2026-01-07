// --- CONFIGURATION ---
const scriptURL = 'https://script.google.com/macros/s/AKfycbz6kvy4Wn8dmmXVbcx2gg-PI8D6a30l7x5Z7X6Xn4FwrfycrJ3A403_wm1batb39_8N/exec';
const GEMINI_API_KEY = 'AIzaSyCAy6nPEJYUIpZMQlr71RRh2p6I8Jd4QVg'; 

let stream = null;
let flash = false;

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
    const vehicle = document.getElementById('vehNo').value.toUpperCase().trim(); 
    const duration = document.getElementById('duration').value;
    const amount = document.getElementById('priceLabel').innerText;

    if (vehicle.length < 4) {
        alert("Please enter a valid Vehicle Number");
        return;
    }

    const payBtn = document.getElementById('payBtn');
    payBtn.innerText = "Processing...";
    payBtn.disabled = true;

    setTimeout(() => {
        let expiry = new Date();
        expiry.setHours(expiry.getHours() + parseInt(duration));

        document.getElementById('receipt').classList.remove('hidden');
        document.getElementById('recVehicle').innerText = vehicle;
        document.getElementById('recTime').innerText = expiry.toLocaleTimeString();

        const receiptDiv = document.getElementById('receipt');
        if (!document.getElementById('printGroup')) {
            const btnGroup = document.createElement('div');
            btnGroup.id = "printGroup";
            btnGroup.className = "mt-4 space-y-3";
            btnGroup.innerHTML = `
                <button onclick="printThermalBill('${vehicle}', '${expiry.toLocaleTimeString()}', '${amount}')" 
                    class="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase shadow-lg flex items-center justify-center gap-2">
                    <i class="fas fa-print"></i> Print Bill
                </button>
                <button onclick="location.reload()" 
                    class="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase">
                    Next Vehicle
                </button>
            `;
            receiptDiv.appendChild(btnGroup);
        }

        payBtn.innerText = "PAID & SAVED";
        
        fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                vehicle: vehicle, 
                expiry: expiry.toISOString(),
                amount: amount 
            })
        });
    }, 1000);
}

// --- THERMAL PRINT ENGINE ---
function printThermalBill(veh, exp, amt) {
    const printWindow = window.open('', '_blank');
    const date = new Date().toLocaleDateString();
    
    printWindow.document.write(`
        <html>
            <head><title>Print Receipt</title></head>
            <style>
                body { font-family: monospace; width: 58mm; text-align: center; padding: 10px; margin: 0; }
                .header { font-weight: bold; font-size: 1.2em; }
                .divider { border-top: 1px dashed black; margin: 5px 0; }
                .big { font-size: 1.5em; font-weight: bold; margin: 5px 0; }
            </style>
            <body>
                <div class="header">SMC PARKING</div>
                <div class="divider"></div>
                <div>DATE: ${date}</div>
                <div style="margin-top:5px;">VEHICLE:</div>
                <div class="big">${veh}</div>
                <div>VALID UNTIL:</div>
                <div class="big">${exp}</div>
                <div class="divider"></div>
                <div class="header">TOTAL: ${amt}</div>
            </body>
        </html>
    `);
    
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// --- PHOTO-BASED CAMERA FUNCTIONS ---
async function openCam() {
    const overlay = document.getElementById('camOverlay');
    overlay.style.display = 'flex';
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } } 
        });
        document.getElementById('video').srcObject = stream;
    } catch (err) { 
        alert("Camera Error: Please check permissions."); 
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
    const beep = document.getElementById('beepSound');

    const scanWindow = document.querySelector('.scan-window');
    const rect = scanWindow.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    // Crop precisely to the yellow box
    canvas.width = rect.width * scaleX;
    canvas.height = rect.height * scaleY;

    ctx.drawImage(video, (rect.left - videoRect.left) * scaleX, (rect.top - videoRect.top) * scaleY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    
    video.pause(); 
    btn.innerText = "GEMINI AI SCANNING...";
    btn.disabled = true;

    // Convert image to base64 for Gemini API
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    const payload = {
        contents: [{
            parts: [
                { text: "Extract the vehicle registration number from this Indian number plate. Return ONLY the alphanumeric code (e.g., GJ05BK1234). If the plate has two rows, merge them into one line. Ignore 'IND' and special characters. Return 'NONE' if no plate is found." },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const plateText = result.candidates[0].content.parts[0].text.replace(/[^A-Z0-9]/gi, "").toUpperCase();

        if (plateText.length >= 4 && plateText !== "NONE") {
            document.getElementById('vehNo').value = plateText;
            if(beep) beep.play();
            closeCam();
        } else {
            alert("Plate not recognized. Align it inside the YELLOW BOX and try again.");
            video.play();
        }
    } catch (err) {
        console.error("AI Error:", err);
        alert("AI Scan failed. Check your internet connection.");
        video.play();
    } finally {
        btn.innerText = "SCAN NOW";
        btn.disabled = false;
    }
}