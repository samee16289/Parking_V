// --- CONFIGURATION ---
const scriptURL = 'https://script.google.com/macros/s/AKfycbz6kvy4Wn8dmmXVbcx2gg-PI8D6a30l7x5Z7X6Xn4FwrfycrJ3A403_wm1batb39_8N/exec';
// UPDATED TO GEMINI API
const GEMINI_API_KEY = 'AIzaSyCAy6nPEJYUIpZMQlr71RRh2p6I8Jd4QVg'; 

let stream = null;
let flash = false;

// --- AI INITIALIZATION ---
console.log("SMC Smart AI Scanner: Gemini AI Vision Mode Active");

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
            幕mode: 'no-cors',
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
                <div style="font-size:0.8em">DATE: ${date}</div>
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

    // --- CROP LOGIC ---
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
    btn.innerText = "AI THINKING...";
    btn.disabled = true;

    // Convert to Base64 for Gemini
    const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // Gemini API Request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const requestBody = {
        contents: [{
            parts: [
                { text: "Read the Indian license plate in this image. VERY IMPORTANT: Do not include the vertical 'IND' text or any symbols. Return ONLY the alphanumeric registration number (e.g., GJ05XX1234)." },
                { inline_data: { mime_type: "image/jpeg", data: base64Image } }
            ]
        }]
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();
        
        if (data.candidates && data.candidates[0].content) {
            let resultText = data.candidates[0].content.parts[0].text.replace(/\s/g, "").toUpperCase();
            
            // Final safety filter to remove non-alphanumeric noise
            const cleanPlate = resultText.replace(/[^A-Z0-9]/g, "");

            if (cleanPlate.length >= 6) {
                document.getElementById('vehNo').value = cleanPlate;
                if(beep) beep.play();
                closeCam();
            } else {
                alert("Plate not clear. Try again.");
                video.play();
            }
        } else {
            alert("AI could not read the image. Check lighting.");
            video.play();
        }
    } catch (err) {
        alert("Gemini AI Error. Check internet/API key.");
        video.play();
    } finally {
        btn.innerText = "SCAN NOW";
        btn.disabled = false;
    }
}