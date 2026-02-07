import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "../../../../lib/firebaseAdmin";
import puppeteer from "puppeteer";

type PdfPayload = {
  html?: string;
  filename?: string;
};

async function requireAuth(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, message: "Missing bearer token" } as const;
  }
  try {
    const token = match[1];
    const decoded = await adminAuth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid } as const;
  } catch {
    return { ok: false, status: 401, message: "Invalid token" } as const;
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAuth(request);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.message }, { status: guard.status });
  }

  const body = (await request.json().catch(() => null)) as PdfPayload | null;
  const html = body?.html ?? "";
  if (!html) {
    return NextResponse.json({ error: "Missing html" }, { status: 400 });
  }

  const filename = body?.filename ?? "report.pdf";

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    const pdfBytes = new Uint8Array(pdf);

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } finally {
    await browser.close();
  }
}
