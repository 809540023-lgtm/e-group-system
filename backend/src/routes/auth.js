/**
 * 認證路由
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { validationResult, body } = require('express-validator');
const supabase = require('../services/supabase');
const { generateToken, verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * POST /api/auth/register - 註冊新用戶
 */
router.post('/register', [
  body('email').isEmail(),
  body('username').isLength({ min: 3 }),
  body('password').isLength({ min: 6 }),
  body('full_name').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password, full_name } = req.body;

    // 檢查是否已存在
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`email.eq.${email},username.eq.${username}`)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // 預設角色 (一般用戶)
    const { data: defaultRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'user')
      .single();

    // 加密密碼
    const password_hash = await bcrypt.hash(password, 10);

    // 建立用戶
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        email,
        username,
        password_hash,
        full_name,
        role_id: defaultRole?.id
      }])
      .select()
      .single();

    if (error) throw error;

    const token = generateToken(newUser);

    res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        full_name: newUser.full_name
      },
      token
    });
  } catch (error) {
    logger.error('Registration failed:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login - 登入
 */
router.post('/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // 取得用戶
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 驗證密碼
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 更新登入時間
    await supabase
      .from('users')
      .update({ last_login: new Date() })
      .eq('id', user.id);

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        role_id: user.role_id
      },
      token
    });
  } catch (error) {
    logger.error('Login failed:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me - 取得當前用戶信息
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    res.json({
      id: user.id,
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role_id: user.role_id
    });
  } catch (error) {
    logger.error('Get user failed:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

module.exports = router;
