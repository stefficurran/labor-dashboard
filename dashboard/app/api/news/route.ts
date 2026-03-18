import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q");
  const category = searchParams.get("category") || "";

  if (!query && !category) {
    return NextResponse.json(
      { error: "Please provide a search query or category" },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured" },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    language: "en",
    prioritydomain: "top",
  });
  if (query) params.set("q", query);
  if (category) params.set("category", category);

  const res = await fetch(
    `https://newsdata.io/api/1/latest?${params.toString()}`
  );
  const data = await res.json();

  if (data.status === "error") {
    return NextResponse.json(
      { error: data.results?.message || "API error" },
      { status: 502 }
    );
  }

  return NextResponse.json(data);
}
