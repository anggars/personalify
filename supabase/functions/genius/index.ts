import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0"
];

serve(async (req) => {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

  if (!target) return new Response("Missing ?url=", { status: 400 });

  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
        "Referer": "https://genius.com/",
        "Accept": "text/html",
      },
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*" 
      },
    });
  } catch (e) {
    return new Response(e.message, { status: 500 });
  }
});