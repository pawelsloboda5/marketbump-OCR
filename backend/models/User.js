const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  discordId: { type: String, required: true, unique: true },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
  readMoreClicks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Article' }],
});

module.exports = mongoose.model('User', UserSchema);
