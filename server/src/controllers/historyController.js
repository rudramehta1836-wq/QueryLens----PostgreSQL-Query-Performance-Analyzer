/**
 * History controller.
 */

const { getHistory, getHistoryItem, deleteHistoryItem } = require('../services/historyService');
const { createError } = require('../middleware/errorHandler');

/**
 * GET /api/history
 */
async function listHistory(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));

    const data = await getHistory(page, limit);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/history/:id
 */
async function getHistoryById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw createError('Invalid history ID.', 400, 'VALIDATION_ERROR');
    }

    const item = await getHistoryItem(id);
    if (!item) {
      throw createError('History item not found.', 404, 'NOT_FOUND');
    }

    res.json({ success: true, data: item, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/history/:id
 */
async function deleteHistory(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw createError('Invalid history ID.', 400, 'VALIDATION_ERROR');
    }

    const deleted = await deleteHistoryItem(id);
    if (!deleted) {
      throw createError('History item not found.', 404, 'NOT_FOUND');
    }

    res.json({ success: true, data: { deleted: true }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { listHistory, getHistoryById, deleteHistory };
