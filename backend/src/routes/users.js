/**
 * 用戶管理路由
 */

const express = require('express');
const router = express.Router();
const supabase = require('../services/supabase');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * GET /api/users - 取得用戶列表 (管理員專用)
 */
router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data: users, count, error } = await supabase
      .from('users')
      .select(`
        id, email, username, full_name, role_id, is_active, created_at,
        roles(id, name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      users,
      total: count,
      page,
      limit,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Get users failed:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * PATCH /api/users/:id - 更新用戶信息 (管理員專用)
 */
router.patch('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, role_id, is_active } = req.body;

    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (role_id) updateData.role_id = role_id;
    if (typeof is_active === 'boolean') updateData.is_active = is_active;

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, user: updated });
  } catch (error) {
    logger.error('Update user failed:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * GET /api/users/roles - 取得所有角色
 */
router.get('/roles/list', verifyToken, async (req, res) => {
  try {
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*');

    if (error) throw error;

    res.json({ roles });
  } catch (error) {
    logger.error('Get roles failed:', error);
    res.status(500).json({ error: 'Failed to get roles' });
  }
});

/**
 * POST /api/users/roles - 建立新角色 (管理員專用)
 */
router.post('/roles', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, permissions } = req.body;

    const { data: role, error } = await supabase
      .from('roles')
      .insert([{
        name,
        description,
        permissions: permissions || []
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, role });
  } catch (error) {
    logger.error('Create role failed:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

/**
 * DELETE /api/users/:id - 刪除用戶 (管理員專用)
 */
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;

    // 防止刪除自己
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete user failed:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
