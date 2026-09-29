const DEFAULT_INSTRUCTIONS = [
  "Du bist PRISMA, ein warmer und kluger deutschsprachiger Sprachassistent.",
  "Sprich klar, natürlich und eher knapp.",
  "Du bist kein Mensch und behauptest nie, Gefühle oder reale Wahrnehmung zu haben.",
  "Wenn du etwas nicht weißt, sag es offen.",
  "Unterbrich nicht unnötig und passe dich der Sprache des Gegenübers an."
].join(" ");

const NATIVE_APP_ORIGIN = "https://appassets.androidplatform.net";

function responseHeaders(request, contentType = "application/json; charset=utf-8") {
  const headers = {
    "content-type": contentType,
    "cache-control": "no-store"
  };
  if (request && request.headers.get("origin") === NATIVE_APP_ORIGIN) {
    headers["access-control-allow-origin"] = NATIVE_APP_ORIGIN;
    headers["access-control-allow-methods"] = "POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type";
    headers.vary = "Origin";
  }
  return headers;
}

function json(body, status = 200, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request)
  });
}

async function privacyPreservingId(value) {
  const bytes = new TextEncoder().encode(value || "anonymous");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function onRequestPost(context) {
  const apiKey = context.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "server_misconfigured" }, 503, context.request);
  }

  let requestBody;
  try {
    requestBody = await context.request.json();
  } catch {
    return json({ error: "invalid_request" }, 400, context.request);
  }

  if (!requestBody || typeof requestBody.sdp !== "string" || requestBody.sdp.length < 20) {
    return json({ error: "missing_sdp" }, 400, context.request);
  }

  const session = {
    type: "realtime",
    model: context.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: context.env.PRISMA_INSTRUCTIONS || DEFAULT_INSTRUCTIONS,
    audio: {
      input: {
        turn_detection: {
          type: "server_vad"
        }
      },
      output: {
        voice: context.env.OPENAI_VOICE || "marin"
      }
    }
  };

  const form = new FormData();
  form.set("sdp", requestBody.sdp);
  form.set("session", JSON.stringify(session));

  const response = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      authorization: "Bearer " + apiKey,
      "OpenAI-Safety-Identifier": await privacyPreservingId(requestBody.clientId)
    },
    body: form
  });

  const responseText = await response.text();
  if (response.ok) {
    // The Realtime calls endpoint returns the SDP answer as plain text. The
    // PRISMA clients use a small JSON envelope, so keep the API key server-side
    // while returning precisely the data needed for setRemoteDescription().
    return json({
      transport: {
        type: "answer",
        sdp: responseText
      }
    }, response.status, context.request);
  }

  return new Response(responseText, {
    status: response.status,
    headers: responseHeaders(context.request, response.headers.get("content-type") || "application/json; charset=utf-8")
  });
}

export function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      ...responseHeaders(context.request),
      allow: "POST, OPTIONS"
    }
  });
}
