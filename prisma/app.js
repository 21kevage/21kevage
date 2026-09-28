const elements = {
  canvas: document.querySelector("#faceCanvas"),
  status: document.querySelector("#statusText"),
  hint: document.querySelector("#hintText"),
  transcript: document.querySelector("#liveTranscript"),
  talkButton: document.querySelector("#talkButton"),
  talkLabel: document.querySelector("#talkButtonLabel"),
  muteButton: document.querySelector("#muteButton"),
  remoteAudio: document.querySelector("#remoteAudio"),
  infoButton: document.querySelector("#infoButton"),
  dialog: document.querySelector("#infoDialog"),
  closeInfoButton: document.querySelector("#closeInfoButton"),
  nativeSettings: document.querySelector("#nativeSettings"),
  endpointInput: document.querySelector("#endpointInput"),
  saveEndpointButton: document.querySelector("#saveEndpointButton"),
  endpointFeedback: document.querySelector("#endpointFeedback")
};

const app = {
  state: "idle",
  muted: false,
  localStream: null,
  peerConnection: null,
  dataChannel: null,
  audioContext: null,
  micMeter: null,
  remoteMeter: null,
  assistantText: "",
  demoOnly: false
};

const isNativeShell = Boolean(globalThis.AndroidBridge);

function getRealtimeEndpoint() {
  if (isNativeShell && typeof globalThis.AndroidBridge.getRealtimeEndpoint === "function") {
    const endpoint = globalThis.AndroidBridge.getRealtimeEndpoint();
    if (typeof endpoint === "string" && endpoint.startsWith("https://")) {
      return endpoint;
    }
    return "";
  }
  return "/api/realtime-call";
}

class AudioMeter {
  constructor(context, stream) {
    this.context = context;
    this.source = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.72;
    this.samples = new Uint8Array(this.analyser.fftSize);
    this.source.connect(this.analyser);
  }

  readEnergy() {
    this.analyser.getByteTimeDomainData(this.samples);
    let total = 0;
    for (let index = 0; index < this.samples.length; index += 1) {
      const sample = (this.samples[index] - 128) / 128;
      total += sample * sample;
    }
    return Math.min(1, Math.sqrt(total / this.samples.length) * 8);
  }

  dispose() {
    try {
      this.source.disconnect();
      this.analyser.disconnect();
    } catch {
      // The browser may already have released the audio nodes.
    }
  }
}

class PrismaFace {
  constructor(canvas, getSignal) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d", { alpha: false });
    this.getSignal = getSignal;
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 1;
    this.resize = this.resize.bind(this);
    window.addEventListener("resize", this.resize);
    this.resize();
    requestAnimationFrame((time) => this.render(time));
  }

  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, box.width);
    this.height = Math.max(1, box.height);
    this.canvas.width = Math.round(this.width * this.pixelRatio);
    this.canvas.height = Math.round(this.height * this.pixelRatio);
  }

  particle(x, y, radius, hue, alpha) {
    const gradient = this.context.createRadialGradient(x, y, 0, x, y, radius * 3.7);
    gradient.addColorStop(0, "hsla(" + hue + ", 100%, 76%, " + alpha + ")");
    gradient.addColorStop(0.36, "hsla(" + hue + ", 98%, 59%, " + (alpha * 0.48) + ")");
    gradient.addColorStop(1, "hsla(" + hue + ", 92%, 46%, 0)");
    this.context.fillStyle = gradient;
    this.context.beginPath();
    this.context.arc(x, y, radius * 3.7, 0, Math.PI * 2);
    this.context.fill();
  }

  curve(points, hue, alpha, width) {
    const context = this.context;
    context.strokeStyle = "hsla(" + hue + ", 100%, 69%, " + alpha + ")";
    context.lineWidth = width;
    context.lineCap = "round";
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  }

  render(time) {
    const context = this.context;
    const signal = this.getSignal();
    const pulse = signal.energy;
    const speaking = signal.state === "speaking";
    const hueShift = (time * 0.025 + (speaking ? 78 : 0)) % 360;
    const centerX = this.width / 2;
    const centerY = this.height * 0.47;
    const scale = Math.min(this.width, this.height) * 0.36;

    context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    context.fillStyle = "#080510";
    context.fillRect(0, 0, this.width, this.height);

    const background = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, scale * 2.5);
    background.addColorStop(0, "hsla(" + ((hueShift + 275) % 360) + ", 86%, 15%, 0.55)");
    background.addColorStop(0.52, "rgba(12, 7, 25, 0.25)");
    background.addColorStop(1, "rgba(3, 2, 8, 0)");
    context.fillStyle = background;
    context.fillRect(0, 0, this.width, this.height);

    for (let band = 0; band < 3; band += 1) {
      const points = [];
      const count = 96;
      const radius = scale * (1.1 + band * 0.18);
      for (let index = 0; index <= count; index += 1) {
        const angle = (index / count) * Math.PI * 2;
        const wobble = Math.sin(time * 0.0014 + angle * (7 + band * 2)) * scale * 0.035;
        const beat = Math.sin(time * 0.0022 + angle * 13) * pulse * scale * 0.16;
        points.push({
          x: centerX + Math.cos(angle) * (radius + wobble + beat),
          y: centerY + Math.sin(angle) * (radius * 1.04 + wobble + beat)
        });
      }
      this.curve(points, (hueShift + 130 + band * 66) % 360, 0.12 + pulse * 0.22, 1 + band * 0.5);
    }

    const outlineCount = 180;
    for (let index = 0; index < outlineCount; index += 1) {
      const angle = (index / outlineCount) * Math.PI * 2;
      const noise = Math.sin(time * 0.0015 + angle * 11) * 0.035 + Math.cos(time * 0.0009 + angle * 19) * 0.025;
      const beat = Math.sin(angle * 7 + time * 0.003) * pulse * 0.1;
      const radiusX = scale * (0.71 + noise + beat);
      const radiusY = scale * (0.94 + noise + beat);
      const x = centerX + Math.cos(angle) * radiusX;
      const y = centerY + Math.sin(angle) * radiusY;
      const hue = (hueShift + index * 2.2) % 360;
      const radius = 0.85 + pulse * 2.8 + (index % 5 === 0 ? 0.85 : 0);
      this.particle(x, y, radius, hue, 0.54 + pulse * 0.32);
    }

    const eyeY = centerY - scale * 0.18;
    const eyeDistance = scale * 0.3;
    for (const direction of [-1, 1]) {
      const eyeX = centerX + direction * eyeDistance;
      for (let index = 0; index < 28; index += 1) {
        const angle = (index / 28) * Math.PI * 2;
        const eyeOpen = 0.42 + pulse * 0.22;
        const x = eyeX + Math.cos(angle) * scale * 0.13;
        const y = eyeY + Math.sin(angle) * scale * eyeOpen * 0.32;
        this.particle(x, y, 1.25 + pulse * 1.8, (hueShift + 170 + index * 5) % 360, 0.8);
      }
      this.particle(eyeX + direction * pulse * scale * 0.03, eyeY, scale * (0.045 + pulse * 0.05), (hueShift + 305) % 360, 0.86);
    }

    const browOffset = Math.sin(time * 0.0024) * scale * 0.016;
    this.curve([
      { x: centerX - scale * 0.46, y: eyeY - scale * 0.2 + browOffset },
      { x: centerX - scale * 0.31, y: eyeY - scale * 0.26 - browOffset },
      { x: centerX - scale * 0.15, y: eyeY - scale * 0.2 + browOffset }
    ], (hueShift + 42) % 360, 0.58, 1.3 + pulse * 2);
    this.curve([
      { x: centerX + scale * 0.15, y: eyeY - scale * 0.2 + browOffset },
      { x: centerX + scale * 0.31, y: eyeY - scale * 0.26 - browOffset },
      { x: centerX + scale * 0.46, y: eyeY - scale * 0.2 + browOffset }
    ], (hueShift + 42) % 360, 0.58, 1.3 + pulse * 2);

    const mouthPoints = [];
    const mouthWidth = scale * 0.32;
    const mouthY = centerY + scale * 0.39;
    const mouthOpen = speaking ? scale * (0.045 + pulse * 0.22) : scale * (0.018 + pulse * 0.06);
    for (let index = 0; index <= 50; index += 1) {
      const percent = index / 50;
      const x = centerX - mouthWidth + percent * mouthWidth * 2;
      const lip = Math.sin(percent * Math.PI) * mouthOpen;
      const vibration = Math.sin(time * 0.015 + index * 0.8) * pulse * scale * 0.018;
      mouthPoints.push({ x, y: mouthY + lip + vibration });
    }
    this.curve(mouthPoints, (hueShift + 326) % 360, 0.9, 2 + pulse * 5);
    for (let index = 0; index < mouthPoints.length; index += 3) {
      const point = mouthPoints[index];
      this.particle(point.x, point.y, 0.85 + pulse * 2.1, (hueShift + 326 + index * 2) % 360, 0.66);
    }

    const bars = 36;
    for (let index = 0; index < bars; index += 1) {
      const angle = (index / bars) * Math.PI * 2 - Math.PI / 2;
      const near = scale * 0.78;
      const level = 0.16 + Math.abs(Math.sin(time * 0.007 + index * 1.7)) * 0.18 + pulse * 0.62;
      const far = near + scale * level * (index % 2 === 0 ? 0.72 : 0.44);
      const x1 = centerX + Math.cos(angle) * near;
      const y1 = centerY + Math.sin(angle) * near;
      const x2 = centerX + Math.cos(angle) * far;
      const y2 = centerY + Math.sin(angle) * far;
      context.strokeStyle = "hsla(" + ((hueShift + index * 9) % 360) + ", 100%, 68%, " + (0.18 + pulse * 0.42) + ")";
      context.lineWidth = 1.2 + pulse * 2.2;
      context.beginPath();
      context.moveTo(x1, y1);
      context.lineTo(x2, y2);
      context.stroke();
    }

    requestAnimationFrame((nextTime) => this.render(nextTime));
  }
}

function currentSignal() {
  const mic = app.micMeter ? app.micMeter.readEnergy() : 0;
  const assistant = app.remoteMeter ? app.remoteMeter.readEnergy() : 0;
  const idlePulse = app.state === "idle" ? 0.025 : 0;
  return {
    state: app.state,
    energy: Math.min(1, idlePulse + mic * 0.58 + assistant * 0.92)
  };
}

new PrismaFace(elements.canvas, currentSignal);

function setState(nextState, status, hint) {
  app.state = nextState;
  document.body.dataset.state = nextState;
  elements.status.textContent = status;
  elements.hint.textContent = hint;
  const running = nextState === "listening" || nextState === "speaking" || nextState === "demo";
  elements.talkLabel.textContent = running ? "Gespräch beenden" : "Gespräch starten";
  elements.talkButton.setAttribute("aria-label", running ? "Gespräch beenden" : "Gespräch starten");
}

function getClientId() {
  const storageKey = "prisma-anonymous-client-id";
  let clientId = localStorage.getItem(storageKey);
  if (!clientId) {
    clientId = crypto.randomUUID();
    localStorage.setItem(storageKey, clientId);
  }
  return clientId;
}

function clearAssistantText() {
  app.assistantText = "";
  elements.transcript.textContent = "";
}

function displayAssistantDelta(delta) {
  app.assistantText += delta;
  elements.transcript.textContent = app.assistantText;
}

function handleRealtimeEvent(event) {
  let message;
  try {
    message = JSON.parse(event.data);
  } catch {
    return;
  }

  if (message.type === "input_audio_buffer.speech_started") {
    clearAssistantText();
    setState("listening", "Ich höre dir zu", "Sprich einfach ganz normal.");
  }

  if (message.type === "response.created" || message.type === "response.output_audio.delta") {
    setState("speaking", "PRISMA spricht", "Du kannst jederzeit dazwischenreden.");
  }

  if (message.type === "response.output_audio_transcript.delta" && message.delta) {
    displayAssistantDelta(message.delta);
  }

  if (message.type === "response.done") {
    setState("listening", "Ich höre dir zu", "Sprich einfach ganz normal.");
  }
}

function configureRemoteAudio(stream) {
  elements.remoteAudio.srcObject = stream;
  elements.remoteAudio.play().catch(() => {
    // Android allows playback after the next direct user interaction.
  });
  if (app.remoteMeter) {
    app.remoteMeter.dispose();
  }
  app.remoteMeter = new AudioMeter(app.audioContext, stream);
}

async function startConversation() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setState("error", "Mikrofon nicht verfügbar", "Öffne PRISMA bitte in Chrome oder Samsung Internet.");
    return;
  }

  setState("connecting", "Verbinde mich", "Mikrofon wird vorbereitet …");
  clearAssistantText();

  try {
    app.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    app.audioContext = new AudioContext();
    await app.audioContext.resume();
    app.micMeter = new AudioMeter(app.audioContext, app.localStream);

    const connection = new RTCPeerConnection();
    app.peerConnection = connection;
    app.localStream.getAudioTracks().forEach((track) => connection.addTrack(track, app.localStream));
    connection.ontrack = (trackEvent) => {
      const stream = trackEvent.streams[0];
      if (stream) {
        configureRemoteAudio(stream);
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setState("error", "Verbindung unterbrochen", "Tippe erneut, um es noch einmal zu versuchen.");
      }
    };

    const channel = connection.createDataChannel("oai-events");
    app.dataChannel = channel;
    channel.addEventListener("message", handleRealtimeEvent);

    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    const realtimeEndpoint = getRealtimeEndpoint();
    if (!realtimeEndpoint) {
      throw new Error("server_not_configured");
    }
    const sessionResponse = await fetch(realtimeEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sdp: offer.sdp,
        clientId: getClientId()
      })
    });
    const responseBody = await sessionResponse.json().catch(() => ({}));
    if (!sessionResponse.ok || !responseBody.transport || !responseBody.transport.sdp) {
      const reason = responseBody.error || responseBody.message || "Die Sprachverbindung ist noch nicht eingerichtet.";
      throw new Error(reason);
    }

    await connection.setRemoteDescription({
      type: responseBody.transport.type || "answer",
      sdp: responseBody.transport.sdp
    });
    app.demoOnly = false;
    setState("listening", "Ich höre dir zu", "Sprich einfach ganz normal.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die Sprachverbindung ist noch nicht eingerichtet.";
    if (app.peerConnection) {
      app.peerConnection.close();
      app.peerConnection = null;
    }
    app.demoOnly = true;
    setState("demo", "Visualizer-Modus", "Die Stimme kommt dazu, sobald die sichere Server-Verbindung eingerichtet ist.");
    elements.transcript.textContent =
      message === "server_misconfigured" || message === "server_not_configured"
        ? "OpenAI-Serverzugang fehlt noch."
        : "";
  }
}

function stopConversation() {
  if (app.dataChannel && app.dataChannel.readyState === "open") {
    app.dataChannel.close();
  }
  if (app.peerConnection) {
    app.peerConnection.close();
  }
  if (app.localStream) {
    app.localStream.getTracks().forEach((track) => track.stop());
  }
  if (app.micMeter) {
    app.micMeter.dispose();
  }
  if (app.remoteMeter) {
    app.remoteMeter.dispose();
  }
  if (app.audioContext) {
    app.audioContext.close().catch(() => {});
  }
  elements.remoteAudio.srcObject = null;
  app.localStream = null;
  app.peerConnection = null;
  app.dataChannel = null;
  app.audioContext = null;
  app.micMeter = null;
  app.remoteMeter = null;
  app.demoOnly = false;
  app.muted = false;
  elements.muteButton.setAttribute("aria-pressed", "false");
  clearAssistantText();
  setState("idle", "Bereit", "Tippe auf den Kreis und sprich mit mir.");
}

elements.talkButton.addEventListener("click", () => {
  if (app.state === "idle" || app.state === "error") {
    startConversation();
  } else {
    stopConversation();
  }
});

elements.muteButton.addEventListener("click", () => {
  if (!app.localStream) {
    return;
  }
  app.muted = !app.muted;
  app.localStream.getAudioTracks().forEach((track) => {
    track.enabled = !app.muted;
  });
  elements.muteButton.setAttribute("aria-pressed", String(app.muted));
  elements.hint.textContent = app.muted ? "Dein Mikrofon ist stummgeschaltet." : "Sprich einfach ganz normal.";
});

elements.infoButton.addEventListener("click", () => elements.dialog.showModal());
elements.closeInfoButton.addEventListener("click", () => elements.dialog.close());

if (isNativeShell) {
  elements.nativeSettings.hidden = false;
  elements.endpointInput.value = getRealtimeEndpoint();
  elements.saveEndpointButton.addEventListener("click", () => {
    const endpoint = elements.endpointInput.value.trim();
    const valid = endpoint.startsWith("https://") && endpoint.length < 301;
    if (!valid) {
      elements.endpointFeedback.textContent = "Bitte eine vollständige HTTPS-Adresse eintragen.";
      return;
    }
    const saved = globalThis.AndroidBridge.setRealtimeEndpoint(endpoint);
    elements.endpointFeedback.textContent = saved ? "Gespeichert." : "Adresse konnte nicht gespeichert werden.";
  });
}

if ("serviceWorker" in navigator && !isNativeShell && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
}
