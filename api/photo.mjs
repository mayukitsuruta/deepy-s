const photoShares = "https://firestore.googleapis.com/v1/projects/deepy-s/databases/(default)/documents/photoShares";
const photoId = /^[a-f0-9]{32}$/;
const photoData = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

function unavailable() {
  return new Response("写真が見つからないか、有効期限が切れました。", { status: 404, headers });
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!photoId.test(id || "")) return unavailable();

    try {
      // 認証情報を付けずに取得し、公開範囲と期限はFirestoreのルールにも従う。
      const response = await fetch(`${photoShares}/${id}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (response.status === 403 || response.status === 404) return unavailable();
      if (!response.ok) throw new Error(`Firestore HTTP ${response.status}`);

      const { fields } = await response.json();
      const expiresAt = Date.parse(fields?.expiresAt?.timestampValue);
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return unavailable();

      const dataUrl = fields?.dataUrl?.stringValue;
      if (typeof dataUrl !== "string" || dataUrl.length > 900000) return unavailable();
      const image = photoData.exec(dataUrl);
      if (!image) return unavailable();

      const [, format, base64] = image;
      const bytes = Buffer.from(base64, "base64");
      if (!bytes.length) return unavailable();
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers: {
          ...headers,
          "Content-Type": `image/${format}`,
          "Content-Disposition": `inline; filename="deepys-photo.${format}"`,
          "Content-Length": String(bytes.length),
        },
      });
    } catch (error) {
      console.error("写真の取得に失敗:", error.message);
      return new Response("写真を読み込めませんでした。少し待ってからもう一度開いてね。", { status: 503, headers });
    }
  },
};
