import { adsTxt } from "@/lib/ads/config";

export function GET() {
  const body = adsTxt(process.env);
  return new Response(body ?? "", {
    status: body ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
