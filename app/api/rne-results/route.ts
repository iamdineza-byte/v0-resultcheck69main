import { NextResponse } from "next/server"

const allowedEndpoints = new Set(["status", "by-index"])
const INDEX_PATTERN = /^[A-Za-z0-9-]{3,40}$/
const BATCH_LIMIT = 1000
const BATCH_CONCURRENCY = 12
const requestCounts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 30
const WINDOW_MS = 60_000
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

async function fetchBatchResult(baseUrl: string, indexNumber: string) {
  const targetUrl = new URL(`${baseUrl}/by-index`)
  targetUrl.searchParams.set("indexNumber", indexNumber)
  targetUrl.searchParams.set("_t", String(Date.now()))
  const response = await fetch(targetUrl, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Upstream status ${response.status}`)
  const body = await response.text()
  try {
    return body ? JSON.parse(body) : null
  } catch {
    throw new Error("Invalid upstream response")
  }
}

export async function POST(request: Request) {
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
  }

  const baseUrl = process.env.RNE_RESULTS_API_BASE_URL?.replace(/\/$/, "")
  if (!baseUrl) return NextResponse.json({ error: "RNE results API is not configured" }, { status: 500 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const indexes = body && typeof body === "object" && "indexes" in body ? (body as { indexes?: unknown }).indexes : null
  if (!Array.isArray(indexes) || indexes.length === 0 || indexes.length > BATCH_LIMIT || indexes.some((value) => typeof value !== "string" || !INDEX_PATTERN.test(value))) {
    return NextResponse.json({ error: `Provide 1-${BATCH_LIMIT} valid index numbers` }, { status: 400 })
  }

  const results: Array<{ index: string; result: unknown; error?: string }> = []
  for (let offset = 0; offset < indexes.length; offset += BATCH_CONCURRENCY) {
    const chunk = indexes.slice(offset, offset + BATCH_CONCURRENCY) as string[]
    const chunkResults = await Promise.all(chunk.map(async (index) => {
      try {
        return { index, result: await fetchBatchResult(baseUrl, index) }
      } catch {
        return { index, result: null, error: "lookup_failed" }
      }
    }))
    results.push(...chunkResults)
  }

  return NextResponse.json({ results })
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
