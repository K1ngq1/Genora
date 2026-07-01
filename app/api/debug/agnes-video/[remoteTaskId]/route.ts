const API_BASE = "https://apihub.agnes-ai.com/v1";

export async function GET(
  _request: Request,
  context: { params: Promise<{ remoteTaskId: string }> }
) {
  const { remoteTaskId } = await context.params;
  if (!/^[a-zA-Z0-9_-]+$/.test(remoteTaskId)) {
    return Response.json({ ok: false, error: "INVALID_TASK_ID" }, { status: 400 });
  }

  const apiKey = process.env.AGNES_VIDEO_V2_0_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({
      ok: false,
      remoteTaskId,
      error: "MISSING_AGNES_VIDEO_V2_0_API_KEY",
      hint: "请在 .env 中配置 AGNES_VIDEO_V2_0_API_KEY",
    }, { status: 503 });
  }

  const url = `${API_BASE}/videos/${remoteTaskId}`;
  console.log(`[debug-agnes] request url=${url} remoteTaskId=${remoteTaskId}`);

  let httpStatus = 0;
  let rawText = "";
  let raw: unknown = null;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    httpStatus = response.status;
    rawText = await response.text();

    console.log(`[debug-agnes] response remoteTaskId=${remoteTaskId} httpStatus=${httpStatus} bodyLen=${rawText.length}`);
    console.log(`[debug-agnes] body=${rawText}`);

    try {
      raw = JSON.parse(rawText);
    } catch {
      // non-JSON, keep rawText only
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[debug-agnes] fetch failed remoteTaskId=${remoteTaskId} error=${message}`);
    return Response.json({
      ok: false,
      remoteTaskId,
      httpStatus: 0,
      remoteStatus: null,
      raw: null,
      rawText: null,
      error: message,
    }, { status: 502 });
  }

  let remoteStatus: string | null = null;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    remoteStatus = String(obj.status ?? obj.state ?? "").toLowerCase() || null;
  }

  return Response.json({
    ok: httpStatus >= 200 && httpStatus < 300,
    remoteTaskId,
    httpStatus,
    remoteStatus,
    raw,
    rawText: rawText.slice(0, 2000),
  });
}
