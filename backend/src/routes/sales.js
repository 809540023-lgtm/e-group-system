/**
 * 銷售追蹤路由
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/sales/order - 建立銷售訂單
 */
router.post('/order', verifyToken, async (req, res) => {
  try {
    const {
      inventory_item_id,
      platform,
      buyer_name,
      buyer_contact,
      sale_price,
      payment_method
    } = req.body;

    const { data: order, error } = await supabase
      .from('sales_orders')
      .insert([{
        inventory_item_id,
        platform,
        buyer_name,
        buyer_contact,
        sale_price,
        payment_method,
        sale_status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // 更新上架狀態
    await supabase
      .from('platform_listings')
      .update({ listing_status: 'sold', sold_at: new Date() })
      .eq('inventory_item_id', inventory_item_id);

    res.json({ success: true, order });
  } catch (error) {
    logger.error('Create order failed:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

/**
 * GET /api/sales/orders - 取得銷售訂單列表
 */
router.get('/orders', verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all' } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('sales_orders')
      .select(`
        *,
        inventory_items(id, product_name)
      `, { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('sale_status', status);
    }

    const { data: orders, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      orders,
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Get orders failed:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

/**
 * PATCH /api/sales/:id - 更新訂單狀態
 */
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { sale_status, paid_at, shipped_at, completed_at, notes } = req.body;

    const updateData = {
      sale_status,
      updated_at: new Date()
    };

    if (paid_at) updateData.paid_at = paid_at;
    if (shipped_at) updateData.shipped_at = shipped_at;
    if (completed_at) updateData.completed_at = completed_at;
    if (notes) updateData.notes = notes;

    const { data: updated, error } = await supabase
      .from('sales_orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, order: updated });
  } catch (error) {
    logger.error('Update order failed:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

/**
 * GET /api/sales/stats - 銷售統計
 */
router.get('/stats', verifyToken, async (req, res) => {
  try {
    // 已銷售商品數
    const { count: sold_count } = await supabase
      .from('sales_orders')
      .select('id', { count: 'exact' })
      .eq('sale_status', 'completed');

    // 總銷售額
    const { data: sales_data } = await supabase
      .from('sales_orders')
      .select('sale_price')
      .eq('sale_status', 'completed');

    const total_revenue = sales_data?.reduce((sum, order) => sum + (order.sale_price || 0), 0) || 0;

    // 平均售價
    const avg_price = sold_count > 0 ? total_revenue / sold_count : 0;

    // 按平台統計
    const { data: by_platform } = await supabase
      .from('sales_orders')
      .select('platform', { count: 'exact' })
      .eq('sale_status', 'completed')
      .then(result => {
        const grouped = {};
        result.data?.forEach(item => {
          grouped[item.platform] = (grouped[item.platform] || 0) + 1;
        });
        return { data: grouped };
      });

    res.json({
      sold_count,
      total_revenue,
      avg_price: Math.round(avg_price),
      by_platform
    });
  } catch (error) {
    logger.error('Get sales stats failed:', error);
    res.status(500).json({ error: 'Failed to get sales stats' });
  }
});

module.exports = router;
