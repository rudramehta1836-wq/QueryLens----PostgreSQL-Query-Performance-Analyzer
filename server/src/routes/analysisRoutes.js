const express = require('express');
const { z } = require('zod');
const { getExamples, analyseQuery } = require('../controllers/analysisController');
const { validateRequest } = require('../middleware/validateRequest');

const router = express.Router();

// Validation schema for analysis requests
const analyseSchema = z.object({
  sql: z.string()
    .min(1, 'SQL query is required')
    .max(5000, 'Query is too long (max 5000 characters)')
});

router.get('/examples', getExamples);
router.post('/analyse', validateRequest(analyseSchema), analyseQuery);

module.exports = router;
