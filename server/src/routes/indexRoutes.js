const express = require('express');
const { testRecommendation, resetDemoIndexes } = require('../controllers/indexController');

const router = express.Router();

router.post('/recommendations/:id/test', testRecommendation);
router.delete('/demo-indexes', resetDemoIndexes);

module.exports = router;
