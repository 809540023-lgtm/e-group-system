import { NextResponse } from 'next/server';
import { createGoogleSourceAdapter } from '@jp/integrations/google';

export const dynamic = 'force-dynamic';

/**
 * 商品圖代理（規劃書 04、13 章；模組 04、06）。
 *
 * 只接受 Drive 檔案 ID，不接受任意 URL，避免變成開放代理。
 * 未設定 Google 憑證時明確回報 integration_pending，不回傳假圖。
 */
export async function GET(
  _request: Request,
  context: { readonly params: Promise<{ readonly assetId: string }> },
): Promise<NextResponse> {
  const { assetId } = await context.params;
  const fileId = decodeURIComponent(assetId);

  if (!/^[A-Za-z0-9_-]{10,}$/.test(fileId)) {
    return NextResponse.json({ status: 'rejected', reason: '不合法的檔案識別碼。' }, { status: 400 });
  }

  const adapter = createGoogleSourceAdapter();
  const capability = adapter.capability();
  if (capability.status !== 'ready') {
    return NextResponse.json(
      { status: 'integration_pending', reason: '尚未設定 Google 憑證，無法代理商品圖。', missingEnv: capability.missingEnv },
      { status: 503 },
    );
  }

  const file = await adapter.getDriveFile(fileId);
  if (!file.ok) {
    return NextResponse.json({ status: 'rejected', reason: file.message }, { status: 404 });
  }

  // 只回傳中繼資料；實際位元組由後端以短效連結取得，不在此暴露憑證。
  return NextResponse.json({
    status: 'ok',
    asset: { id: file.value.id, name: file.value.name, mimeType: file.value.mimeType, version: file.value.version },
  });
}
