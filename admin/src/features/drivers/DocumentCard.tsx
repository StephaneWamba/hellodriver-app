import { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCheck, IconDownload, IconFileText, IconX } from '@/components/ui/icons';
import { formatDate } from '@/lib/utils';
import { DOCUMENT_LABELS, type DriverDocument } from './types';

const STATUS_TONE = {
  pending: 'warning',
  verified: 'success',
  rejected: 'danger',
} as const;

const STATUS_LABEL = {
  pending: 'En attente',
  verified: 'Vérifié',
  rejected: 'Rejeté',
} as const;

function isPdf(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

interface DocumentCardProps {
  document: DriverDocument;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy?: boolean;
}

export function DocumentCard({ document, onApprove, onReject, busy }: DocumentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const pdf = isPdf(document.storageUrl);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="group relative block aspect-[4/3] w-full overflow-hidden bg-surface-sunken"
        >
          {pdf ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <IconFileText className="h-9 w-9" />
              <span className="text-xs font-medium">Document PDF</span>
            </div>
          ) : (
            <img
              src={document.storageUrl}
              alt={DOCUMENT_LABELS[document.documentType]}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          )}

          <div className="absolute inset-0 flex items-start justify-end bg-ink/0 p-2 opacity-0 transition-all duration-150 group-hover:bg-ink/25 group-hover:opacity-100">
            <a
              href={document.storageUrl}
              download
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg bg-white/95 p-2 text-ink shadow-raised hover:bg-white"
              title="Télécharger"
            >
              <IconDownload className="h-4 w-4" />
            </a>
          </div>
        </button>

        <div className="space-y-2.5 p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{DOCUMENT_LABELS[document.documentType]}</p>
            <Badge tone={STATUS_TONE[document.uploadStatus]}>{STATUS_LABEL[document.uploadStatus]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Envoyé {formatDate(document.uploadedAt)}</p>
          {document.uploadStatus === 'rejected' && document.rejectionReason && (
            <p className="rounded-lg bg-danger-light px-2.5 py-1.5 text-xs text-danger">
              {document.rejectionReason}
            </p>
          )}

          {document.uploadStatus === 'pending' && !rejecting && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="flex-1" onClick={onApprove} loading={busy}>
                <IconCheck className="h-4 w-4" /> Approuver
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)} disabled={busy}>
                <IconX className="h-4 w-4" /> Rejeter
              </Button>
            </div>
          )}

          {rejecting && (
            <div className="space-y-2 pt-1">
              <textarea
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Motif du rejet (visible par le chauffeur)…"
                className="w-full resize-none rounded-lg border border-border px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-danger/25 focus:border-danger"
                rows={2}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  className="flex-1"
                  disabled={reason.trim().length < 10}
                  loading={busy}
                  onClick={() => {
                    onReject(reason.trim());
                    setRejecting(false);
                    setReason('');
                  }}
                >
                  Confirmer le rejet
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={DOCUMENT_LABELS[document.documentType]}
        description={`Envoyé le ${formatDate(document.uploadedAt)}`}
        size="lg"
      >
        <div className="flex max-h-[70vh] items-center justify-center bg-ink/5 p-4">
          {pdf ? (
            <iframe src={document.storageUrl} title={document.documentType} className="h-[65vh] w-full rounded-xl bg-white" />
          ) : (
            <img
              src={document.storageUrl}
              alt={DOCUMENT_LABELS[document.documentType]}
              className="max-h-[65vh] w-auto rounded-xl object-contain shadow-raised"
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <a href={document.storageUrl} download target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <IconDownload className="h-4 w-4" /> Télécharger
            </Button>
          </a>
        </div>
      </Dialog>
    </>
  );
}
