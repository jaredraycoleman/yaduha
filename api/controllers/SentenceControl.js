const SentenceModel = require('../models/SentenceModel');
const express = require('express');
const lodash = require('lodash');
const helpers = require('../helpers');


const allFields = ['english', 'paiute', 'image', 'audio'];
const requiredFields = ['english', 'paiute'];
const defaultSearchFields = ['english', 'paiute'];

/** 
 * Adds a sentence to the database.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function createSentence(req, res) {
    let diff = lodash.difference(requiredFields, Object.keys(req.body));

    if (diff.length > 0) {
        res.status(400).json({
            success: false, 
            result: "Missing params in request body: " + diff.toString()
        });
        return;
    }

    let sentence = new SentenceModel({
        paiute: req.body.paiute,
        english: req.body.english,
    });
    sentence.save().then(result => {
        return res.json({success: true, result: result});
    }).catch(err => {
        return res.status(500).json({success: false, result: err});
    });
}

/** 
 * Updates a sentence in the database.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function updateSentence(req, res) {
    let update = lodash.pick(req.body, allFields);
    SentenceModel.updateOne(
        {_id: req.params.id}, {$set: update}
    ).then(sentence => {
        if (!sentence) {
            return res.status(400).json({ success: false, result: "No such sentence exists" });
        } else {
            return res.json({success: true, result: sentence});
        }
    }).catch(err => {
        return res.status(500).json({success: false, result: err});
    });
}

/** 
 * Gets a sentence from the database.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function getSentence(req, res) {
    let fields = req.query.fields || allFields;
    let project = {};
    fields.forEach(field => project[field] = 1);
    SentenceModel.findOne({_id: req.params.id}, project).then(sentence => {
        if (!sentence) res.status(404).json({success: false, result: sentence});
        else res.json({success: true, result: sentence});
    }).catch(err => {
        res.status(500).json({success: false, result: err});
    });
}

/** 
 * Gets a random sentence from the database.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function getRandomSentence(req, res) {
    let fields = req.query.fields || allFields;
    let project = {};
    fields.forEach(field => project[field] = 1);
    SentenceModel.aggregate([{$sample: {size: 1}}, {$project: project}]).then(result => {
        if (!result) {
            return res.status(404).json({success: false, result: "Sentences is empty"});
        } else {
            return res.json({success: true, result: result[0]});
        }
    }).catch(err => {
        return res.status(500).json({success: false, result: err});
    });
}


/** 
 * Deletes a sentence from the database.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function deleteSentence(req, res) {
    SentenceModel.findByIdAndDelete(req.params.id).then(result => {
        if (!result || result.deletedCount <= 0) {
            return res.status(404).json({success: false, result: "No sentence with ID found"});
        } else {
            return res.json({success: true, result: result});
        }
    }).catch(err => {
        return res.status(500).json({success: false, result: err});
    });
}

/** 
 * Search for sentence.
 * @param {express.Request} req
 * @param {express.Response} res
 */
function search(req, res) {
    let mode = req.query.mode == null ? "contains" : req.query.mode;
    let offset = parseInt(req.query.offset || 0);
    let limit = parseInt(req.query.limit || helpers.DEFAULT_LIMIT);
    
    let searchFields = req.query.searchFields || defaultSearchFields;
    let fields = req.query.fields || allFields;
    let project = {};
    fields.forEach(field => project[field] = 1);
    let pipeline = helpers.getSearchPipeline(req.query.query, mode, searchFields, limit, offset, project);
    
    SentenceModel.aggregate(pipeline).then(result => {
        if (!result || result.length <= 0) {
            return res.json({success: true, result: [], total: 0});
        } else {
            return res.json({success: true, result: result[0].result, total: result[0].total});
        }
    }).catch(result => {
        res.status(500).json({success: false, result: result});
    });
}

module.exports = {
    create: createSentence,
    update: updateSentence,
    retrieve: getSentence,
    delete: deleteSentence,
    search: search,
    random: getRandomSentence,
};