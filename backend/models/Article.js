const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  ticker: { type: String, required: true },
  title: { type: String, required: true },
  author: { type: String, required: true },
  published_utc: { type: Date, required: true },
  article_url: { type: String, required: true },
  description: { type: String, required: true },
  article_text: { type: String, required: true },
  ai_summary: { type: String }, 
  relevant_stocks: [{ type: String }]
});

module.exports = mongoose.model('Article', ArticleSchema);
