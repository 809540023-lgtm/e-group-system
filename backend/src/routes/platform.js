/**
 * 平台上架路由
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/platform/list - 批量上架商品
 */
router.post('/list', verifyToken, async (req, res) => {
  try {
    const { item_ids, platforms } = req.body;

    const listings = [];
    for (const item_id of item_ids) {
      for (const platform of platforms) {
        listings.push({
          inventory_item_id: item_id,
          platform,
          listing_status: 'draft'
        });
      }
    }

    const { data: created, error } = await supabase
      .from('platform_listings')
      .insert(listings)
      .select();

    if (error) throw error;

    res.json({ success: true, listings: created });
  } catch (error) {
    logger.error('Batch listing failed:', error);
    res.status(500).json({ error: 'Failed to create listings' });
  }
});

/**
 * GET /api/platform/listings - 取得上架列表
 */
router.get('/listings', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, platform = 'all', status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('platform_listings')
      .select(`
        *,
        inventory_items(id, product_name, suggested_price)
      `, { count: 'exact' });

    if (platform !== 'all') {
      query = query.eq('platform', platform);
    }

    if (status !== 'all') {
      query = query.eq('listing_status', status);
    }

    const { data: listings, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      listings,
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Get listings failed:', error);
    res.status(500).json({ error: 'Failed to get listings' });
  }
});

/**
 * PATCH /api/platform/:id - 更新上架狀態
 */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { listing_status, external_id, notes } = req.body;

    const updateData = {
      listing_status,
      updated_at: new Date()
    };

    if (external_id) updateData.external_id = external_id;
    if (notes) updateData.notes = notes;
    if (listing_status === 'active') updateData.listed_at = new Date();
    if (listing_status === 'sold') updateData.sold_at = new Date();

    const { data: updated, error } = await supabase
      .from('platform_listings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, listing: updated });
  } catch (error) {
    logger.error('Update listing failed:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

/**
 * DELETE /api/platform/:id - 移除上架
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('platform_listings')
      .update({
        listing_status: 'removed',
        updated_at: new Date()
      })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    logger.error('Remove listing failed:', error);
    res.status(500).json({ error: 'Failed to remove listing' });
  }
});

/**
 * GET /api/platform/stats/active - 取得在線商品統計
 */
router.get('/stats/active', verifyToken, async (req, res) => {
  try {
    const { data: stats } = await supabase
      .from('platform_listings')
      .select('platform', { count: 'exact' })
      .eq('listing_status', 'active')
      .then(result => {
        const grouped = {};
        result.data?.forEach(item => {
          grouped[item.platform] = (grouped[item.platform] || 0) + 1;
        });
        return { data: grouped };
      });

    res.json({ stats });
  } catch (error) {
    logger.error('Get stats failed:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
