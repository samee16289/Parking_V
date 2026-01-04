// --- CONFIGURATION ---
const scriptURL = 'https://script.google.com/macros/s/AKfycbz6kvy4Wn8dmmXVbcx2gg-PI8D6a30l7x5Z7X6Xn4FwrfycrJ3A403_wm1batb39_8N/exec';
const OCR_SPACE_KEY = 'K82387542888957'; // Your OCR.space API Key

let stream = null;
let flash = false;

// --- AI INITIALIZATION ---
console.log("SMC Smart AI Scanner: OCR.space Cloud Mode Active");

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
            video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
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

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    video.pause(); 
    
    btn.innerText = "AI FILTERING...";
    btn.disabled = true;

    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    const formData = new FormData();
    formData.append("base64Image", base64Image);
    formData.append("apikey", OCR_SPACE_KEY);
    formData.append("language", "eng");
    formData.append("OCREngine", "2"); 

    try {
        const response = await fetch("https://api.ocr.space/parse/image", {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.ParsedResults && result.ParsedResults.length > 0) {
            // Remove all spaces and special characters to handle fragmented text
            let rawText = result.ParsedResults[0].ParsedText.replace(/\s/g, "").toUpperCase();
            
            // --- UPDATED SMART FILTER ENGINE ---
            // Pattern for standard Indian Plates (e.g., GJ05TU8271)
            // Expects: 2 Letters + 2 Digits + 1-2 Letters + 4 Digits
            const platePattern = /[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}/;
            const match = rawText.match(platePattern);

            if (match) {
                document.getElementById('vehNo').value = match[0];
                const beep = document.getElementById('beepSound');
                if(beep) beep.play();
                closeCam();
            } else {
                // FALLBACK: Filter out small text like "IND" by requiring length >= 8
                let cleaned = rawText.replace(/[^A-Z0-9]/gi, "");
                if(cleaned.length >= 8) {
                    document.getElementById('vehNo').value = cleaned.substring(0, 10);
                    closeCam();
                } else {
                    alert("Plate not recognized. Please focus on the central white area of the plate.");
                    video.play();
                }
            }
        } else {
            alert("No text detected. Ensure lighting is good.");
            video.play();
        }
    } catch (err) {
        alert("Cloud AI Error. Check your internet connection.");
        video.play();
    } finally {
        btn.innerText = "SCAN NOW";
        btn.disabled = false;
    }
}