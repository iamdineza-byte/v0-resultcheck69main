import { NextResponse } from "next/server"

const allowedEndpoints = new Set(["status", "by-index"])

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get("endpoint")

  if (!endpoint || !allowedEndpoints.has(endpoint)) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 })
  }

  const baseUrl = process.env.RNE_RESULTS_API_BASE_URL?.replace(/\/$/, "")
  if (!baseUrl) {
    return NextResponse.json({ error: "RNE results API is not configured" }, { status: 500 })
  }

  const targetUrl = new URL(`${baseUrl}/${endpoint}`)
  if (endpoint === "by-index") {
    const indexNumber = searchParams.get("indexNumber")
    if (!indexNumber) {
      return NextResponse.json({ error: "Missing index number" }, { status: 400 })
    }
    targetUrl.searchParams.set("indexNumber", indexNumber)
    targetUrl.searchParams.set("_t", searchParams.get("_t") ?? String(Date.now()))
  }

  try {
    const response = await fetch(targetUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const body = await response.text()

    if (process.env.NODE_ENV === "development") {
      console.debug("[v0] RNE request", { endpoint, status: response.status, body })
    }

    return new NextResponse(body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
    })
  } catch (error) {
    console.error("[v0] RNE request failed", error)
    return NextResponse.json({ error: "Unable to reach the RNE results API" }, { status: 502 })
  }
}
