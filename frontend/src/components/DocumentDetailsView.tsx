import type { Address, DocumentDetails } from "../types/api";

interface Props {
  details: DocumentDetails | null | undefined;
}

function formatAddress(a: Address | null | undefined): string | null {
  if (!a) return null;
  const lines = [
    a.line1,
    a.line2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
  ].filter((s): s is string => !!s && s.trim().length > 0);
  return lines.length ? lines.join("\n") : null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="font-semibold text-ink-500">{label}</dt>
      <dd className="text-ink-900 whitespace-pre-line">{value ?? <span className="text-ink-400">—</span>}</dd>
    </>
  );
}

export function DocumentDetailsView({ details }: Props) {
  if (!details) {
    return (
      <div className="rounded-lg border border-dashed border-ink-200 px-4 py-3 text-sm text-ink-500">
        No additional document fields were extracted.
      </div>
    );
  }

  const addr = formatAddress(details.patient_address);
  const presAddr = formatAddress(details.prescriber?.address);

  return (
    <div className="space-y-5 text-sm">
      {(details.document_type || details.order_date) && (
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Document
          </h4>
          <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4">
            {details.document_type && (
              <Field label="Type" value={details.document_type} />
            )}
            {details.order_date && (
              <Field label="Order date" value={details.order_date} />
            )}
          </dl>
        </section>
      )}

      {addr && (
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Patient address
          </h4>
          <div className="text-ink-900 whitespace-pre-line">{addr}</div>
        </section>
      )}

      {details.prescriber &&
        (details.prescriber.name ||
          details.prescriber.npi ||
          details.prescriber.phone ||
          details.prescriber.fax ||
          presAddr) && (
          <section>
            <h4 className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">
              Prescriber
            </h4>
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4">
              <Field label="Name" value={details.prescriber.name} />
              {details.prescriber.npi && (
                <Field
                  label="NPI"
                  value={
                    <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                      {details.prescriber.npi}
                    </code>
                  }
                />
              )}
              {details.prescriber.phone && (
                <Field label="Phone" value={details.prescriber.phone} />
              )}
              {details.prescriber.fax && (
                <Field label="Fax" value={details.prescriber.fax} />
              )}
              {presAddr && <Field label="Address" value={presAddr} />}
            </dl>
          </section>
        )}

      {details.diagnoses.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Diagnoses
          </h4>
          <ul className="space-y-1.5">
            {details.diagnoses.map((d, i) => (
              <li key={i} className="flex items-baseline gap-2">
                {d.code && (
                  <code className="rounded bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-800">
                    {d.code}
                  </code>
                )}
                <span className="text-ink-900">{d.description ?? ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {details.items.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold tracking-wider text-ink-500 uppercase">
            Items ordered
          </h4>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="border-b border-ink-200 py-2 pr-3">Code</th>
                <th className="border-b border-ink-200 py-2 pr-3">Description</th>
                <th className="border-b border-ink-200 py-2 pr-3">Side</th>
                <th className="border-b border-ink-200 py-2 pr-3 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {details.items.map((it, i) => (
                <tr key={i}>
                  <td className="border-b border-ink-100 py-2 pr-3">
                    {it.code ? (
                      <code className="rounded bg-ink-100 px-1.5 py-0.5 text-xs">
                        {it.code}
                      </code>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-ink-100 py-2 pr-3 text-ink-900">
                    {it.description ?? <span className="text-ink-400">—</span>}
                  </td>
                  <td className="border-b border-ink-100 py-2 pr-3 text-ink-700">
                    {it.side ?? <span className="text-ink-400">—</span>}
                  </td>
                  <td className="border-b border-ink-100 py-2 pr-3 text-right text-ink-900">
                    {it.quantity ?? <span className="text-ink-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
