from flask import Flask, request, jsonify
from PIL import Image, ImageEnhance, ImageFilter
import pytesseract
import re
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

def process_image(image_path):
    image = Image.open(image_path)
    image = image.convert('L')
    image = image.filter(ImageFilter.SHARPEN)
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(3)
    image = image.resize((image.width * 4, image.height * 4))

    text = pytesseract.image_to_string(image)
    text = text.replace('\n', ' ').replace('\r', ' ')
    text = re.sub(r'[^\x00-\x7F]+', ' ', text)

    ocr_corrections = {
        'TWITR': 'TWTR',
        'VT': 'VTI',
        'VIO0': 'VIOO',
    }

    for incorrect, correct in ocr_corrections.items():
        text = text.replace(incorrect, correct)

    tickers_set = load_tickers()
    tickers, shares = extract_portfolio(text, tickers_set)

    portfolio = dict(zip(tickers, shares))
    return portfolio

def load_tickers():
    with open('company_tickers.json', 'r') as file:
        tickers_data = json.load(file)
    tickers_set = set(item['ticker'] for item in tickers_data.values())
    tickers_set.add('VTI')
    tickers_set.add('VIOO')
    return tickers_set

def extract_portfolio(text, tickers_set):
    tickers = []
    shares = []
    words = text.split()
    ticker_pattern = re.compile(r'^[A-Z]{2,5}$')
    share_pattern = re.compile(r'^(\d+\.?\d*)$')

    i = 0
    while i < len(words):
        word = words[i]
        if ticker_pattern.match(word) and word in tickers_set:
            tickers.append(word)
            if i + 1 < len(words) and share_pattern.match(words[i + 1]):
                try:
                    shares.append(float(words[i + 1]))
                    i += 2
                except ValueError:
                    shares.append(0)
                    i += 1
            else:
                shares.append(0)
                i += 1
        else:
            i += 1

    while len(shares) < len(tickers):
        shares.append(0)

    return tickers, shares

@app.route('/api/upload-screenshot', methods=['POST'])
def upload_screenshot():
    if 'screenshot' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['screenshot']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        file_path = 'uploaded_image.jpg'
        file.save(file_path)
        portfolio = process_image(file_path)
        portfolio_array = [{'ticker': ticker, 'shares': shares, 'price': 0} for ticker, shares in portfolio.items()]
        return jsonify({'stockData': portfolio_array})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
