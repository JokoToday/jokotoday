import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { renderPickupNotification, type PickupEvent } from '../../supabase/functions/_shared/customer-notification-templates';
interface Policy { event_type: PickupEvent; enabled: boolean; email_enabled: boolean; line_enabled: boolean; timing_minutes: number; version: number; enrollment_after: string }
interface Control { paused: boolean; email_paused: boolean; line_paused: boolean; line_ready: boolean; updated_at: string; last_tick_at: string | null; last_tick_counts: { email_ready: boolean; line_ready: boolean } | null }
interface Operation { pickup_date: string; pickup_open_time: string; pickup_close_time: string; name_en: string }
interface Attempt { number: number; started_at: string; outcome: string | null; reason: string | null }
interface Delivery { channel: string; status: string; attempt_count: number; reason: string | null; recipient: string | null; next_attempt_at: string | null; attempts: Attempt[] | null }
interface History { id: string; order_number: string; notification_type: PickupEvent; scheduled_for: string; event_state: string; held_reason: string | null; disposition: string | null; deliveries: Delivery[] | null }
interface Shadow { order_id: string; order_number: string; pickup_date: string; name_en: string; scheduled_for: string }
interface State { shadow_candidates: Shadow[]; backlog: { due: number; oldest_due: string | null }; settings: Policy[]; control: Control; operations: Operation[]; history: History[] }
const names = { pickup_reminder: 'Pickup reminder', pickup_completed: 'Thank you for pickup', pickup_not_collected: 'Pickup not recorded' };
const bangkok = (value: string | null) => value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
export function CustomerNotificationsManagement() {
  const [state, setState] = useState<State | null>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [controlDraft, setControlDraft] = useState<Control | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<'en' | 'th' | 'zh'>('en'); const [previewType, setPreviewType] = useState<PickupEvent>('pickup_reminder');
  const [operationIndex, setOperationIndex] = useState(0);
  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { const { data, error: rpcError } = await supabase.rpc('admin_notification_state_v1'); if (rpcError) throw rpcError;
      setState(data as State); setControlDraft((data as State).control);
    } catch (err) { setError(String((err as { message?: string })?.message || 'Could not load notification settings')); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!draft) return; setBusy(true); setError('');
    try { const { error: rpcError } = await supabase.rpc('admin_notification_setting_v1', { p_type: draft.event_type, p_enabled: draft.enabled,
      p_email: draft.email_enabled, p_line: draft.line_enabled, p_minutes: draft.timing_minutes, p_version: draft.version });
      if (rpcError) throw rpcError; setDraft(null); setNotice('Saved. Existing schedules retain their timing. Enabling applies to new orders; disabled work is not replayed.'); await load();
    } catch (err) { setError(String((err as { message?: string })?.message || 'Could not save settings')); } finally { setBusy(false); }
  };
  const saveControls = async () => {
    if (!controlDraft) return; setBusy(true); setError('');
    try { const { error: rpcError } = await supabase.rpc('admin_notification_pause_v1', { p_paused: controlDraft.paused,
      p_email_paused: controlDraft.email_paused, p_line_paused: controlDraft.line_paused, p_updated_at: controlDraft.updated_at });
      if (rpcError) throw rpcError; setNotice('Dispatcher controls saved. An already in-flight request cannot be recalled.'); await load();
    } catch (err) { setError(String((err as { message?: string })?.message || 'Could not save controls')); } finally { setBusy(false); }
  };
  const operation = state?.operations[operationIndex];
  const policy = draft?.event_type === previewType ? draft : state?.settings.find((entry) => entry.event_type === previewType);
  const anchorTime = previewType === 'pickup_not_collected' ? operation?.pickup_close_time : operation?.pickup_open_time;
  const due = operation && anchorTime && policy && previewType !== 'pickup_completed'
    ? new Date(new Date(`${operation.pickup_date}T${anchorTime}+07:00`).getTime() + policy.timing_minutes * 60000 * (previewType === 'pickup_reminder' ? -1 : 1)).toISOString() : null;
  const preview = JSON.parse(renderPickupNotification({ version: 1, event_type: previewType, order_number: 'PREVIEW', pickup_date: operation?.pickup_date || 'YYYY-MM-DD',
    location: { name_en: operation?.name_en || 'Pickup location' } }, previewLanguage, 'email', 'preview@example.invalid')) as { html: string };
  return <div className="space-y-6">
    <div className="joko-admin-paper-card p-5"><h2 className="text-xl font-semibold">Customer Notifications</h2>
      <p className="mt-2 text-sm">All times use Asia/Bangkok. Existing confirmation and payment emails continue through their current senders.</p>
      <button type="button" disabled={busy} onClick={() => void load()} className="mt-3 rounded-lg border px-3 py-2">Refresh</button>
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-[#287D79]">{notice}</p>}
    </div>
    {state && controlDraft && <section className="joko-admin-paper-card p-5"><h3 className="font-semibold">Dispatcher controls</h3>
      <p className="my-2 text-sm">Pause retains pending work. Resume still checks freshness and eligibility. Last tick: {bangkok(state.control.last_tick_at)}. Due events: {state.backlog.due}. Oldest due: {bangkok(state.backlog.oldest_due)}.</p>
      <p className="my-2 text-sm">LINE provider context: {state.control.line_ready ? 'Verified' : 'Setup required'}. Provider credentials and the scheduler require server setup.</p>
      {state.control.last_tick_counts && <p className="my-2 text-sm">At the last tick: Email {state.control.last_tick_counts.email_ready ? 'configured' : 'setup required'} · LINE {state.control.last_tick_counts.line_ready ? 'configured' : 'setup required'}.</p>}
      <div className="flex flex-wrap gap-5">{(['paused', 'email_paused', 'line_paused'] as const).map((field) => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={controlDraft[field]} onChange={(event) => setControlDraft({ ...controlDraft, [field]: event.target.checked })} />{field === 'paused' ? 'Pause all new notifications' : field === 'email_paused' ? 'Pause Email' : 'Pause LINE'}</label>)}</div>
      <button type="button" disabled={busy} onClick={() => void saveControls()} className="mt-4 rounded-lg bg-[#287D79] px-4 py-2 text-white">Save controls</button>
    </section>}
    {state && <section className="grid gap-4 md:grid-cols-3">{state.settings.map((entry) => <article key={entry.event_type} className="joko-admin-paper-card p-5">
      <h3 className="font-semibold">{names[entry.event_type]}</h3><p className="my-2 text-sm">{entry.event_type === 'pickup_completed' ? 'After the system confirms collection.' : entry.event_type === 'pickup_reminder' ? `${entry.timing_minutes / 60} hours before pickup opens.` : `${entry.timing_minutes} minutes after pickup closes.`}</p>
      <p className="text-sm">{entry.enabled ? 'Enabled for new orders' : 'Disabled'} · Email {entry.email_enabled ? 'on' : 'off'} · LINE {entry.line_enabled ? 'on' : 'off'}</p>
      <button type="button" disabled={busy} onClick={() => { setDraft({ ...entry }); setPreviewType(entry.event_type); }} className="mt-3 rounded-lg border px-3 py-2">Edit policy</button>
    </article>)}</section>}
    {draft && <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="joko-admin-paper-card space-y-4 p-5"><h3 className="font-semibold">{names[draft.event_type]}</h3>
      <p className="text-sm">Disabling finalizes unsent work. Re-enabling never replays old messages. Timing changes affect newly created events. No-pickup messages do not cancel or refund an order.</p>
      <div className="flex flex-wrap gap-5">{(['enabled', 'email_enabled', 'line_enabled'] as const).map((field) => <label key={field} className="flex items-center gap-2"><input type="checkbox" checked={draft[field]} onChange={(event) => setDraft({ ...draft, [field]: event.target.checked })} />{field === 'enabled' ? 'Enable event' : field === 'email_enabled' ? 'Email' : 'LINE'}</label>)}</div>
      {draft.event_type !== 'pickup_completed' && <label className="block">{draft.event_type === 'pickup_reminder' ? 'Minutes before opening' : 'Grace minutes after closing'}<input type="number" min={0} max={10080} step={1} required value={draft.timing_minutes} onChange={(event) => setDraft({ ...draft, timing_minutes: Number(event.target.value) })} className="ml-3 rounded-lg border px-3 py-2" /></label>}
      <div className="flex gap-3"><button disabled={busy} type="submit" className="rounded-lg bg-[#287D79] px-4 py-2 text-white">Save policy</button><button type="button" onClick={() => setDraft(null)} className="rounded-lg border px-4 py-2">Cancel</button></div>
    </form>}
    <section className="joko-admin-paper-card space-y-3 p-5"><h3 className="font-semibold">Preview · no message is sent</h3><div className="flex flex-wrap gap-3">
      <select aria-label="Preview event" value={previewType} onChange={(event) => setPreviewType(event.target.value as PickupEvent)} className="max-w-full rounded-lg border p-2">{Object.entries(names).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="Preview language" value={previewLanguage} onChange={(event) => setPreviewLanguage(event.target.value as 'en' | 'th' | 'zh')} className="max-w-full rounded-lg border p-2"><option value="en">EN</option><option value="th">TH</option><option value="zh">ZH</option></select>
      {state && <select aria-label="Pickup operation" value={operationIndex} onChange={(event) => setOperationIndex(Number(event.target.value))} className="max-w-full rounded-lg border p-2">{state.operations.map((op, index) => <option key={`${op.pickup_date}-${op.name_en}`} value={index}>{op.pickup_date} · {op.name_en}</option>)}</select>}
    </div><p className="text-sm">{previewType === 'pickup_completed' ? 'Immediate after confirmed pickup.' : due ? `Scheduled for ${bangkok(due)} (Bangkok). The customer’s approximate slot does not change this time.` : 'Configure concrete pickup hours to preview the schedule.'}</p>
      <iframe title="Notification email preview" sandbox="" srcDoc={preview.html.replaceAll('cid:joko-today-logo', 'https://joko.today/JOKO.TODAY_email_logo.png')} className="h-96 w-full rounded-lg border bg-white" />
    </section>
    {state && <section className="joko-admin-paper-card p-5"><h3 className="font-semibold">No-pickup shadow check</h3><p className="my-3 text-sm">Read-only candidates after closing plus grace, within the 12-hour freshness limit. This check creates no events and sends no messages. Compare it with desk records before enabling this event.</p>
      {state.shadow_candidates.length === 0 ? <p className="text-sm">No eligible uncollected orders at this check.</p> : state.shadow_candidates.map((candidate) => <p key={candidate.order_id} className="mt-2 text-sm">{candidate.order_number} · {candidate.pickup_date} · {candidate.name_en} · {bangkok(candidate.scheduled_for)}</p>)}
    </section>}
    {state && <section className="joko-admin-paper-card p-5"><h3 className="mb-3 font-semibold">Recent history</h3><p className="mb-3 text-sm">Sent means provider acceptance. Held and uncertain outcomes require review. Recipients are masked.</p>
      {state.history.length === 0 && <p className="text-sm">No new notification events yet.</p>}
      {state.history.map((event) => <details key={event.id} className="border-t py-3"><summary className="cursor-pointer">{event.order_number} · {names[event.notification_type]} · {event.held_reason ? 'Held' : event.disposition || event.event_state} · {bangkok(event.scheduled_for)}</summary>
        {event.held_reason && <p className="mt-2 text-sm">{event.held_reason}</p>}
        <div className="overflow-x-auto"><table className="mt-3 w-full text-left text-sm"><thead><tr><th className="p-2">Channel</th><th>Recipient</th><th>State</th><th>Attempts</th><th>Reason / retry</th></tr></thead><tbody>{event.deliveries?.map((delivery) => <tr key={delivery.channel}><td className="p-2">{delivery.channel}</td><td>{delivery.recipient || 'Not resolved'}</td><td>{delivery.status}</td><td>{delivery.attempt_count}</td><td>{delivery.reason || '—'} {delivery.next_attempt_at ? `· ${bangkok(delivery.next_attempt_at)}` : ''}</td></tr>)}</tbody></table></div>
        {event.deliveries?.flatMap((delivery) => delivery.attempts?.map((attempt) => <p key={`${delivery.channel}-${attempt.number}`} className="mt-2 text-xs">{delivery.channel} attempt {attempt.number} · {bangkok(attempt.started_at)} · {attempt.outcome || 'In progress'} · {attempt.reason || ''}</p>) || [])}
      </details>)}
    </section>}
  </div>;
}
