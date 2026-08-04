const express = require('express');
const { listHistory, getHistoryById, deleteHistory } = require('../controllers/historyController');

const router = express.Router();

router.get('/history', listHistory);
router.get('/history/:id', getHistoryById);
router.delete('/history/:id', deleteHistory);

module.exports = router;
