-- 006_geo.sql — 站點地圖座標
-- 計畫書第十五章顧客端要求「站點地圖」。以經緯度繪製自帶 SVG 地圖，
-- 不依賴外部圖磚服務，避免個資與第三方追蹤，也避免地圖金鑰成為上線阻礙。

BEGIN;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS lat numeric(9,6);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS lng numeric(9,6);

ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_lat_range;
ALTER TABLE stations ADD CONSTRAINT stations_lat_range
  CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90));

ALTER TABLE stations DROP CONSTRAINT IF EXISTS stations_lng_range;
ALTER TABLE stations ADD CONSTRAINT stations_lng_range
  CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180));

-- 示範站點座標（捷運站出入口附近，實際位置以簽約地址為準）。
UPDATE stations SET lat = 25.052600, lng = 121.520500 WHERE code = 'EG-A01' AND lat IS NULL;
UPDATE stations SET lat = 25.057700, lng = 121.520600 WHERE code = 'EG-B01' AND lat IS NULL;
UPDATE stations SET lat = 25.062600, lng = 121.519200 WHERE code = 'EG-C01' AND lat IS NULL;
UPDATE stations SET lat = 25.071400, lng = 121.520000 WHERE code = 'EG-D01' AND lat IS NULL;

COMMIT;
