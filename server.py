import os
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import easyocr

app = Flask(__name__)
CORS(app)  # Allows the GitHub website to talk to your PC

# --- AI INITIALIZATION ---
# Load YOLOv8 for finding the plate and EasyOCR for reading characters
try:
    model = YOLO('yolov8n.pt') 
    reader = easyocr.Reader(['en']) 
except Exception as e:
    print(f"Error loading models: {e}")

@app.route('/scan', methods=['POST'])
def scan_plate():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    
    # 1. Convert uploaded file to OpenCV format
    file = request.files['image'].read()
    npimg = np.frombuffer(file, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    # 2. YOLOv8 Detection
    results = model(img)
    plate_text = "Not Found"

    for r in results:
        for box in r.boxes.xyxy:
            x1, y1, x2, y2 = map(int, box)
            
            # 3. Crop and Enhance
            # We add 5 pixels of padding to ensure no characters are cut off
            crop = img[max(0, y1-5):min(img.shape[0], y2+5), 
                       max(0, x1-5):min(img.shape[1], x2+5)]
            
            # Convert to Grayscale for better OCR accuracy
            gray_crop = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            
            # 4. Read Text using EasyOCR
            ocr_res = reader.readtext(gray_crop)
            
            if ocr_res:
                # Clean the text: remove spaces and symbols
                raw_text = ocr_res[0][1]
                plate_text = "".join(e for e in raw_text if e.isalnum()).upper()
                break 

    # 5. Return result to the phone
    return jsonify({
        "plate": plate_text,
        "status": "Success" if plate_text != "Not Found" else "Failed"
    })

if __name__ == '__main__':
    # UPDATED: Using port 5501 as requested to match your IP 192.168.241.1
    print("Server starting on http://192.168.241.1:5501")
    app.run(host='0.0.0.0', port=5501)