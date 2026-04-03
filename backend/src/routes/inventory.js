/**
 * 庫存管理路由
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /api/inventory - 取得商品列表
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inventory_items')
      .select('*', { count: 'exact' });

    // 篩選狀態
    if (status !== 'all') {
      query = query.eq('review_status', status);
    }

    const { data: items, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      items,
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Get inventory failed:', error);
    res.status(500).json({ error: 'Failed to get inventory' });
  }
});

/**
 * GET /api/inventory/:id - 取得單個商品詳細信息
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error: itemError } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (itemError) throw itemError;

    const { data: images } = await supabase
      .from('inventory_item_images')
      .select('*')
      .eq('inventory_item_id', id)
      .order('image_order');

    const { data: marketing } = await supabase
      .from('inventory_marketing_assets')
      .select('*')
      .eq('inventory_item_id', id)
      .single();

    res.json({
      item,
      images,
      marketing
    });
  } catch (error) {
    logger.error('Get item failed:', error);
    res.status(500).json({ error: 'Failed to get item' });
  }
});

/**
 * PATCH /api/inventory/:id/review - 審核商品
 */
router.patch('/:id/review', verifyToken, requireRole(['admin', 'reviewer']), async (req, res) => {
  try {
    const { id } = req.params;
    const { review_status, review_notes } = req.body;

    const { data: updated, error } = await supabase
      .from('inventory_items')
      .update({
        review_status,
        review_notes,
        reviewed_by: req.user.id,
        reviewed_at: new Date(),
        needs_review: false
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // 記錄日誌
    await supabase
      .from('inventory_logs')
      .insert([{
        inventory_item_id: id,
        action: 'status_changed',
        old_status: 'pending',
        new_status: review_status,
        updated_by: req.user.id,
        notes: review_notes
      }]);

    res.json({ success: true, item: updated });
  } catch (error) {
    logger.error('Review failed:', error);
    res.status(500).json({ error: 'Failed to review item' });
  }
});

/**
 * PATCH /api/inventory/:id - 編輯商品信息
 */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { suggested_price, min_price, suggested_platforms, condition_summary } = req.body;

    const { data: updated, error } = await supabase
      .from('inventory_items')
      .update({
        suggested_price,
        min_price,
        suggested_platforms,
        condition_summary,
        updated_at: new Date()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, item: updated });
  } catch (error) {
    logger.error('Update item failed:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

/**
 * GET /api/inventory/stats/pending - 取得待審核統計
 */
router.get('/stats/pending', verifyToken, async (req, res) => {
  try {
    const { count, error } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact' })
      .eq('needs_review', true);

    if (error) throw error;

    res.json({ pending_review_count: count });
  } catch (error) {
    logger.error('Get stats failed:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
