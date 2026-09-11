import { NextResponse } from "next/server"

const allowedEndpoints = new Set(["status", "by-index"])
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const WINDOW_MS = 60_000
const INDEX_PATTERN = /^[A-Za-z0-9-]{3,40}$/

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous"
}

function isRateLimited(request: Request) {
  const now = Date.now()
  const key = getClientKey(request)
  const current = requestCounts.get(key)
  if (!current || current.resetAt <= now) {
    requestCounts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > RATE_LIMIT
}

export async function GET(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
  }

  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")
  if (!endpoint || !allowedEndpoints.has(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }

  const baseUrl = process.env.RNE_RESULTS_API_BASE_URL?.replace(/\/$/, "")
  if (!baseUrl) {
    return NextResponse.json({ error: "RNE results API is not configured" }, { status: 500 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(`${baseUrl}/${endpoint}`)
    if (endpoint === "by-index") {
      const indexNumber = searchParams.get("indexNumber") ?? ""
      if (!INDEX_PATTERN.test(indexNumber)) {
        return NextResponse.json({ error: "Invalid index number" }, { status: 400 })
      }
      targetUrl.searchParams.set("indexNumber", indexNumber)
      targetUrl.searchParams.set("_t", String(Date.now()))
    }
  } catch {
    return NextResponse.json({ error: "RNE results API is not configured correctly" }, { status: 500 })
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
  } catch {
    return NextResponse.json({ error: "Unable to reach the RNE results API" }, { status: 502 })
  }
}
