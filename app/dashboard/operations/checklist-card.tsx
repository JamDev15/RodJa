import { ActionForm } from "@/components/collections/action-form";
import { FileLink } from "@/components/collections/bits";
import { Card } from "@/components/operations/bits";
import { UploadForm } from "@/components/operations/upload-form";

interface Checklist {
  id: string;
  title: string;
  status: string;
  completedAt: Date | null;
  items: { id: string; label: string; required: boolean; done: boolean; doneAt: Date | null; note: string | null; photoFileId: string | null }[];
}

export function ChecklistCard({ checklist }: { checklist: Checklist }) {
  const done = checklist.items.filter((i) => i.done).length;
  const completed = checklist.status === "COMPLETED";
  const requiredOpen = checklist.items.filter((i) => i.required && !i.done).length;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-th-ink">
          {checklist.title} <span className="text-sm font-normal text-th-muted">· {done}/{checklist.items.length} done</span>
        </p>
        {completed ? (
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-th-paid-soft px-2 py-0.5 text-xs font-semibold text-th-paid">Completed</span>
            <ActionForm url={`/api/operations/checklists/${checklist.id}`} body={{ action: "reopen" }} toggleLabel="Reopen" submitLabel="Reopen" fields={[{ name: "reason", label: "Why", type: "text", required: true }]} />
          </span>
        ) : (
          requiredOpen === 0 && <ActionForm url={`/api/operations/checklists/${checklist.id}`} body={{ action: "complete" }} submitLabel="Mark checklist complete" variant="success" successMessage="Checklist completed" />
        )}
      </div>
      <ul className="space-y-2">
        {checklist.items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-th-line pt-2 text-sm">
            <div className="min-w-0">
              <p className={i.done ? "text-th-muted line-through" : "text-th-ink"}>
                {i.label}
                {i.required && <span className="ml-1 text-xs text-th-danger">required</span>}
              </p>
              {i.note && <p className="text-xs text-th-muted">{i.note}</p>}
              {i.photoFileId && <FileLink id={i.photoFileId} label="Photo" />}
            </div>
            {!completed && (
              <div className="flex flex-wrap gap-2">
                <ActionForm
                  url={`/api/operations/checklist-items/${i.id}`}
                  body={{ done: !i.done }}
                  submitLabel={i.done ? "Undo" : "Done"}
                  variant={i.done ? "outline" : "success"}
                />
                <ActionForm url={`/api/operations/checklist-items/${i.id}`} body={{ done: i.done }} toggleLabel="Note" submitLabel="Save note" fields={[{ name: "note", label: "Note", type: "text", defaultValue: i.note ?? "" }]} />
                <UploadForm url={`/api/operations/checklist-items/${i.id}`} toggleLabel="Photo" fileLabel="Photo" accept="image/jpeg,image/png,image/webp" submitLabel="Upload" />
              </div>
            )}
          </li>
        ))}
      </ul>
      {!completed && (
        <ActionForm url={`/api/operations/checklists/${checklist.id}`} body={{ action: "add_item" }} toggleLabel="Add an item" submitLabel="Add" fields={[{ name: "label", label: "Item", type: "text", required: true }, { name: "required", label: "Required before completing", type: "checkbox" }]} />
      )}
    </Card>
  );
}
