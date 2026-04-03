/**
 * 儀表板和統計路由
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /api/dashboard/overview - 儀表板概覽
 */
router.get('/overview', verifyToken, async (req, res) => {
  try {
    // 總商品數
    const { count: total_items } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact' });

    // 待審核商品
    const { count: pending_review } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact' })
      .eq('needs_review', true);

    // 已批准商品
    const { count: approved } = await supabase
      .from('inventory_items')
      .select('id', { count: 'exact' })
      .eq('review_status', 'approved');

    // 已銷售商品
    const { count: sold } = await supabase
      .from('sales_orders')
      .select('id', { count: 'exact' })
      .eq('sale_status', 'completed');

    // 總銷售額
    const { data: sales } = await supabase
      .from('sales_orders')
      .select('sale_price')
      .eq('sale_status', 'completed');

    const total_revenue = sales?.reduce((sum, o) => sum + (o.sale_price || 0), 0) || 0;

    // 在線上架數
    const { count: active_listings } = await supabase
      .from('platform_listings')
      .select('id', { count: 'exact' })
      .eq('listing_status', 'active');

    res.json({
      total_items,
      pending_review,
      approved,
      sold,
      total_revenue,
      active_listings,
      timestamp: new Date()
    });
  } catch (error) {
    logger.error('Get overview failed:', error);
    res.status(500).json({ error: 'Failed to get overview' });
  }
});

/**
 * GET /api/dashboard/inventory-trend - 庫存趨勢
 */
router.get('/inventory-trend', verifyToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data: items } = await supabase
      .from('inventory_items')
      .select('created_at, review_status')
      .gte('created_at', startDate.toISOString());

    // 按日期分組
    const trend = {};
    items?.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (!trend[date]) {
        trend[date] = { pending: 0, approved: 0, rejected: 0 };
      }
      trend[date][item.review_status || 'pending']++;
    });

    res.json(trend);
  } catch (error) {
    logger.error('Get inventory trend failed:', error);
    res.status(500).json({ error: 'Failed to get inventory trend' });
  }
});

/**
 * GET /api/dashboard/sales-by-platform - 按平台統計銷售
 */
router.get('/sales-by-platform', verifyToken, async (req, res) => {
  try {
    const { data: sales } = await supabase
      .from('sales_orders')
      .select('platform, sale_price')
      .eq('sale_status', 'completed');

    const byPlatform = {};
    sales?.forEach(sale => {
      if (!byPlatform[sale.platform]) {
        byPlatform[sale.platform] = { count: 0, revenue: 0 };
      }
      byPlatform[sale.platform].count++;
      byPlatform[sale.platform].revenue += sale.sale_price || 0;
    });

    res.json(byPlatform);
  } catch (error) {
    logger.error('Get sales by platform failed:', error);
    res.status(500).json({ error: 'Failed to get sales by platform' });
  }
});

/**
 * GET /api/dashboard/category-distribution - 商品分類分佈
 */
router.get('/category-distribution', verifyToken, async (req, res) => {
  try {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('category, suggested_price');

    const byCategory = {};
    items?.forEach(item => {
      const category = item.category || 'Unknown';
      if (!byCategory[category]) {
        byCategory[category] = { count: 0, total_value: 0 };
      }
      byCategory[category].count++;
      byCategory[category].total_value += item.suggested_price || 0;
    });

    res.json(byCategory);
  } catch (error) {
    logger.error('Get category distribution failed:', error);
    res.status(500).json({ error: 'Failed to get category distribution' });
  }
});

/**
 * GET /api/dashboard/price-distribution - 價格分佈
 */
router.get('/price-distribution', verifyToken, async (req, res) => {
  try {
    const { data: items } = await supabase
      .from('inventory_items')
      .select('suggested_price');

    const ranges = {
      '0-5000': 0,
      '5000-10000': 0,
      '10000-20000': 0,
      '20000-50000': 0,
      '50000+': 0
    };

    items?.forEach(item => {
      const price = item.suggested_price || 0;
      if (price < 5000) ranges['0-5000']++;
      else if (price < 10000) ranges['5000-10000']++;
      else if (price < 20000) ranges['10000-20000']++;
      else if (price < 50000) ranges['20000-50000']++;
      else ranges['50000+']++;
    });

    res.json(ranges);
  } catch (error) {
    logger.error('Get price distribution failed:', error);
    res.status(500).json({ error: 'Failed to get price distribution' });
  }
});

/**
 * GET /api/dashboard/alerts - 系統告警
 */
router.get('/alerts', verifyToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const { data: alerts } = await supabase
      .from('system_alerts')
      .select('*')
      .eq('is_resolved', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    res.json({ alerts });
  } catch (error) {
    logger.error('Get alerts failed:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

module.exports = router;
