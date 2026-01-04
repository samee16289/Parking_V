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
    const beep = document.getElementById('beepSound');

    // --- CROP LOGIC: FOCUS ONLY ON THE YELLOW BOX AREA ---
    const scanWindow = document.querySelector('.scan-window');
    const rect = scanWindow.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;

    const cropX = (rect.left - videoRect.left) * scaleX;
    const cropY = (rect.top - videoRect.top) * scaleY;
    const cropWidth = rect.width * scaleX;
    const cropHeight = rect.height * scaleY;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
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
            let rawText = result.ParsedResults[0].ParsedText.replace(/\s/g, "").toUpperCase();
            
            // 1. SPECIFICALLY REMOVE "IND" if it exists at the start (Blue Tag)
            if (rawText.startsWith("IND")) {
                rawText = rawText.substring(3);
            }

            // 2. Updated Pattern (allows 1 or 2 digit districts like GJ5 or GJ05)
            const platePattern = /[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}/;
            const match = rawText.match(platePattern);

            if (match) {
                document.getElementById('vehNo').value = match[0];
                if(beep) beep.play();
                closeCam();
            } else {
                // FALLBACK: Clean text and remove "IND" if present in fallback
                let cleaned = rawText.replace(/[^A-Z0-9]/gi, "");
                if (cleaned.startsWith("IND")) {
                    cleaned = cleaned.substring(3);
                }

                if(cleaned.length >= 8) {
                    document.getElementById('vehNo').value = cleaned.substring(0, 10);
                    if(beep) beep.play();
                    closeCam();
                } else {
                    alert("Plate not recognized. Align it inside the YELLOW BOX.");
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