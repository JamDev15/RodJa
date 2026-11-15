import { FileLink } from "@/components/collections/bits";
import { when } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";

interface Props {
  viewer: "ADMIN" | "TENANT";
  apiUrl: string;
  subject: string;
  status: string;
  messages: { id: string; senderRole: string; senderName: string; body: string; attachmentFileId: string | null; createdAt: Date }[];
}

/** Conversation bubbles + reply box. Attachments open through the private file route. */
export function ThreadView({ viewer, apiUrl, subject, status, messages }: Props) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-th-ink">{subject}</h1>
      <ol className="space-y-3">
        {messages.map((m) => {
          const mine = m.senderRole === viewer;
          return (
            <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${mine ? "bg-th-brand text-th-on-brand" : "border border-th-line bg-th-surface text-th-ink"}`}>
                <p className={`text-xs ${mine ? "opacity-80" : "text-th-muted"}`}>
                  {m.senderRole === "ADMIN" && viewer === "TENANT" ? "Office" : m.senderName} · {when(m.createdAt.toISOString())}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
                {m.attachmentFileId && (
                  <div className={mine ? "[&_a]:text-th-on-brand" : undefined}>
                    <FileLink id={m.attachmentFileId} label="Attachment" />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {status === "CLOSED" && <p className="text-xs text-th-muted">This conversation was closed by the office. Replying reopens it.</p>}
      <UploadForm url={apiUrl} fields={[{ name: "body", label: "Your message", type: "textarea", required: true }]} fileLabel="Attach a photo or PDF" fileRequired={false} submitLabel="Send" />
    </div>
  );
}
