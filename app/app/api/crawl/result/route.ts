import { NextRequest } from "next/server"
import { getCachedResult } from "@/lib/cache"

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id parameter" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const result = getCachedResult(id)
  if (!result) {
    return new Response(JSON.stringify({ error: "Result not found or expired" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  })
}