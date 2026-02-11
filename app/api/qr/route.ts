import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const data = searchParams.get("data");
    const format = searchParams.get("format") || "svg"; // svg or dataurl

    if (!data) {
      return new NextResponse("Missing data parameter", { status: 400 });
    }

    // Generate QR code as data URL (base64 PNG)
    const dataUrl = await QRCode.toDataURL(data, {
      margin: 4,
      errorCorrectionLevel: "H",
      width: 400,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });

    // Return raw data URL if requested
    if (format === "dataurl") {
      return new NextResponse(dataUrl, {
        headers: {
          "Content-Type": "text/plain",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Otherwise return SVG with embedded image
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 200 200">
      <image href="${dataUrl}" width="200" height="200"/>
    </svg>`;

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("QR generation error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
