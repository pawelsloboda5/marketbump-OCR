const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Article = require('./models/Article');
const fetch = require('node-fetch');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
dotenv.config();

// Setup CORS policy
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

mongoose.connect(process.env.MONGO_URI, {});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.log('Error connecting to MongoDB', err);
});

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  res.send('Hello from Express');
});

app.post('/api/users', async (req, res) => {
  const { email, discordId } = req.body;
  try {
    const newUser = new User({ email, discordId });
    await newUser.save();
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
});

app.get('/api/stocks', async (req, res) => {
  try {
    const response = await fetch(`https://api.polygon.io/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=${process.env.POLYGON_API_KEY}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching stock data' });
  }
});

app.post('/api/articles', async (req, res) => {
  const { title, author, published_utc, article_url, image_url, description, article_text, ai_summary, relevant_stocks } = req.body;
  try {
    const newArticle = new Article({ title, author, published_utc, article_url, image_url, description, article_text, ai_summary, relevant_stocks });
    await newArticle.save();
    res.status(201).json(newArticle);
  } catch (error) {
    res.status(500).json({ error: 'Error creating article' });
  }
});

app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find();
    res.json(articles);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching articles' });
  }
});

const generateAISummary = async (text) => {
  return `This is a mock summary for the article text: ${text.substring(0, 50)}...`;
};

app.get('/api/fetch-articles', async (req, res) => {
  const ticker = req.query.ticker || 'AAPL';
  console.log(ticker);
  try {
    const response = await fetch(`https://api.polygon.io/v2/reference/news?ticker=${ticker}&apiKey=${process.env.POLYGON_API_KEY}`);
    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results)) {
      throw new Error('Unexpected API response structure');
    }

    const articles = await Promise.all(data.results.map(async (article) => {
      const ai_summary = await generateAISummary(article.description || "No description provided");
      return {
        ticker: article.tickers.join(', '),
        title: article.title,
        author: article.author,
        published_utc: article.published_utc,
        article_url: article.article_url,
        description: article.description,
        image_url: article.image_url,
        article_text: article.description,
        ai_summary,
        relevant_stocks: article.tickers,
      };
    }));

    const savedArticles = await Article.insertMany(articles);
    res.status(201).json(savedArticles);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching and storing articles', message: error.message });
  }
});

const upload = multer({ dest: 'uploads/' });

const preprocessImage = async (inputPath, outputPath) => {
  try {
    await sharp(inputPath)
      .grayscale()
      .normalize()
      .toFile(outputPath);
    console.log('Image preprocessing completed.');
  } catch (error) {
    console.error('Error in preprocessing image:', error);
  }
};

const extractTextFromImage = async (imagePath) => {
  try {
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m),
    });
    return result.data.text;
  } catch (error) {
    console.error('Error extracting text with Tesseract:', error);
    throw error;
  }
};

const parseStockData = (text) => {
  const stockData = [];
  const lines = text.split(/[\s\n]+/);
  const stockRegex = /^[A-Z]{2,5}$/;
  const shareRegex = /^(\d+\.?\d*)$/;

  let currentTicker = null;
  lines.forEach(line => {
    if (stockRegex.test(line)) {
      currentTicker = line;
    } else if (currentTicker && shareRegex.test(line)) {
      stockData.push({ ticker: currentTicker, shares: parseFloat(line) });
      currentTicker = null;
    }
  });

  return stockData;
};

app.post('/api/upload-screenshot', upload.single('screenshot'), async (req, res) => {
  const preprocessedImagePath = `uploads/preprocessed-${req.file.filename}.jpeg`;

  try {
    console.log('Received file:', req.file);
    await preprocessImage(req.file.path, preprocessedImagePath);

    const textResults = await extractTextFromImage(preprocessedImagePath);
    console.log('Detected Text:', textResults);
    const stockData = parseStockData(textResults);
    console.log('Stock Data:', stockData);
    res.status(200).json({ stockData });
  } catch (error) {
    res.status(500).json({ error: 'Error processing image', details: error.message });
  } finally {
    fs.unlinkSync(req.file.path);
    if (fs.existsSync(preprocessedImagePath)) {
      fs.unlinkSync(preprocessedImagePath);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
