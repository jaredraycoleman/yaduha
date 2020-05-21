const mongoose = require("mongoose");

const WordSchema = new mongoose.Schema({
    text: String,
    definition: String,
    image: {
        data: String,
        filename: String
    },
    audio: {
        data: String,
        filename: String
    },
    part_of_speech: String,
    words: [{type: mongoose.Types.ObjectId, ref: 'word'}],
    sentences: [{type: mongoose.Types.ObjectId, ref: 'sentence'}],
});

module.exports = mongoose.model('word', WordSchema);
