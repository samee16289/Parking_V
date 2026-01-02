import os
import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from ultralytics import YOLO
import easyocr

app = Flask(__name__)
CORS(app)

# --- AI INITIALIZATION ---
# Using YOLOv8 for localization and EasyOCR for reading
model = YOLO('yolov8n.pt') 
reader = easyocr.Reader(['en'])

@app.route('/scan', methods=['POST'])
def scan_plate():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    
    file = request.files['image'].read()
    npimg = np.frombuffer(file, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    results = model(img)
    plate_text = "Not Found"

    for r in results:
        for box in r.boxes.xyxy:
            x1, y1, x2, y2 = map(int, box)
            
            # IMPROVED CROPPING: Adding more padding around the plate
            h, w, _ = img.shape
            padding = 10
            crop = img[max(0, y1-padding):min(h, y2+padding), 
                       max(0, x1-padding):min(w, x2+padding)]
            
            # IMPROVED VISION: Grayscale + Contrast Enhancement
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            enhanced = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
            
            # Read Text
            ocr_res = reader.readtext(enhanced)
            
            if ocr_res:
                # Try to find the longest string of characters (usually the plate)
                best_match = max(ocr_res, key=lambda x: len(x[1]))
                raw_text = best_match[1]
                plate_text = "".join(e for e in raw_text if e.isalnum()).upper()
                break 

    return jsonify({
        "plate": plate_text,
        "status": "Success" if plate_text != "Not Found" else "Failed"
    })

if __name__ == '__main__':
    print("Server active on http://192.168.241.1:5501")
    app.run(host='0.0.0.0', port=5501)