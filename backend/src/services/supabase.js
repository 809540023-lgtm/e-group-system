const { createClient } = require('@supabase/supabase-js');

// 使用環境變數或預設值（用於開發/演示環境）
const supabaseUrl = process.env.SUPABASE_URL || 'https://demo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'demo-key-not-configured';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
