"use client";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { CameraIcon, CopyIcon, MailIcon, TextIcon, UploadIcon } from "./icons";

export function CaptureBox({ inboundAddress, aiEnabled }: { inboundAddress: string; aiEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"file" | "text">("file");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const send = useCallback(
    async (body: FormData) => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/captures", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Upload failed.");
        setText("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    },
    [router],
  );

  const sendFile = (file: File | undefined | null) => {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    void send(fd);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files)[0];
    if (file) {
      e.preventDefault();
      sendFile(file);
    }
  };

  return (
    <section id="capture" className="card overflow-hidden scroll-mt-24" onPaste={onPaste}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="font-semibold">Add something</h2>
        <div className="inline-flex rounded-full border border-line bg-sunken p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("file")}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-semibold ${mode === "file" ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            <UploadIcon size={15} /> File
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 font-semibold ${mode === "text" ? "bg-surface shadow-sm" : "text-muted"}`}
          >
            <TextIcon size={15} /> Text
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {mode === "file" ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); sendFile(e.dataTransfer.files[0]); }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              drag ? "border-ember bg-ember-soft" : "border-line-strong bg-surface-2"
            }`}
          >
            {busy ? (
              <p className="animate-pulse-soft font-semibold text-ember">Uploading…</p>
            ) : (
              <>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary" onClick={() => camRef.current?.click()}>
                    <CameraIcon size={18} /> Take photo
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                    <UploadIcon size={18} /> Choose file
                  </button>
                </div>
                <p className="mt-3 text-sm text-muted">
                  or drop a photo or PDF here — you can also paste a screenshot
                </p>
                {!aiEnabled && (
                  <p className="mt-2 text-xs text-honey">Photos &amp; PDFs need an Anthropic API key on the server. Pasted text works offline.</p>
                )}
              </>
            )}
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { sendFile(e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { sendFile(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.append("text", text);
              void send(fd);
            }}
            className="space-y-3"
          >
            <textarea
              className="field min-h-36"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Paste an email, a school newsletter, or a message from the class WhatsApp…\n\ne.g. “Swimming moves to Thursdays at 4:30pm from 13 Nov. Bring goggles.”"}
            />
            <div className="flex justify-end">
              <button className="btn btn-primary" disabled={busy || !text.trim()}>
                {busy ? "Reading…" : "Find dates"}
              </button>
            </div>
          </form>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line bg-surface-2 px-4 py-3 text-sm sm:px-5">
        <MailIcon size={17} className="text-muted" />
        <span className="text-ink-2">Or forward emails to</span>
        <code className="rounded-lg bg-sunken px-2 py-0.5 font-mono text-[13px]">{inboundAddress}</code>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            void navigator.clipboard?.writeText(inboundAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <CopyIcon size={15} /> {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </section>
  );
}
