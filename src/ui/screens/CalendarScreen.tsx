import { eventDayKey, KIND_LABEL, upcoming } from '../../domain/calendar';
import { biweeklyDates, holidayMessage, isRealFerien, periodLength } from '../../domain/holidays';
import { examReminders } from '../../domain/reminders';
import type { ClassifiedEvent, EventKind } from '../../domain/types';
import { addDays, atTime, dayKey, daysBetween, formatDate, formatLong, formatShort, formatTime, relativeDays } from '../../lib/dates';
import { useStore } from '../../lib/store';
import { Card, Empty } from '../components';
import { useNav } from '../nav';

const KIND_ICON: Record<EventKind, string> = { klausur: '📚', test: '📝', training: '🏋️', lernen: '✏️', other: '•' };

export default function CalendarScreen() {
  const { report, settings, data } = useStore();
  const { go } = useNav();
  const now = new Date();
  const events = report.events;
  const exams = report.exams;
  const reminders = examReminders(events, settings, new Date(0));
  const next30 = upcoming(events, now, undefined, 30);
  const byDay = new Map<string, ClassifiedEvent[]>();
  for (const e of next30) {
    const k = eventDayKey(e);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const todayKey = dayKey(now);
  const ferien = data.holidays.periods.filter((p) => p.end >= todayKey);
  const holidayDates = settings.holidays.biweeklyEnabled
    ? biweeklyDates(settings.holidays.anchor, now, addDays(now, 60)).filter((k) => atTime(k, settings.holidays.time) > now)
    : [];

  return (
    <>
      {!settings.icsUrls.length && !settings.demoMode && (
        <Card title="Google Kalender verbinden" icon="📅">
          <p className="small secondary" style={{ marginTop: 0 }}>
            Füge die „Geheime Adresse im iCal-Format“ deines Google Kalenders ein. Athlos erkennt dann automatisch Tests, Klausuren, Trainings und
            Lernzeiten.
          </p>
          <button className="btn primary block" onClick={() => go('einstellungen')}>
            Zu den Einstellungen
          </button>
        </Card>
      )}
      {data.calendar.errors.length > 0 && !settings.demoMode && (
        <div className="banner error" style={{ marginBottom: 12 }}>
          {data.calendar.errors.join(' · ')}
        </div>
      )}

      <Card title="Tests & Klausuren" icon="📚">
        {exams.length === 0 ? (
          <Empty>Keine Tests oder Klausuren in den nächsten 60 Tagen gefunden.</Empty>
        ) : (
          <ul className="list">
            {exams.map((e) => {
              const days = daysBetween(now, eventDayKey(e));
              const mine = reminders.filter((r) => r.examId === e.id);
              return (
                <li key={e.id}>
                  <div className="row">
                    <span aria-hidden>{KIND_ICON[e.kind]}</span>
                    <span className="grow">
                      <span className="strong">
                        {KIND_LABEL[e.kind]} {e.subject}
                      </span>
                      <div className="tiny muted">{formatLong(eventDayKey(e))}</div>
                    </span>
                    <span className="pill">{relativeDays(days)}</span>
                  </div>
                  <div className="chips" style={{ marginTop: 8 }}>
                    {mine.map((r) => {
                      const done = r.at <= now;
                      return (
                        <span key={r.offsetDays} className="pill" title={formatDate(r.at)}>
                          {done ? '✓' : '🔔'} {r.offsetDays} T. vorher · {formatShort(r.at)}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Erinnerungen um {settings.reminders.time} Uhr – Test: {settings.reminders.testOffsets.join(', ')} Tage vorher · Klausur:{' '}
          {settings.reminders.klausurOffsets.join(', ')} Tage vorher.
        </p>
      </Card>

      <Card title="Nächste 30 Tage" icon="🗓️">
        {byDay.size === 0 ? (
          <Empty>Keine Termine.</Empty>
        ) : (
          <ul className="list">
            {[...byDay.entries()].map(([day, list]) => (
              <li key={day}>
                <div className="tiny muted strong" style={{ marginBottom: 4 }}>
                  {formatShort(day)} · {relativeDays(daysBetween(now, day))}
                </div>
                {list.map((e) => (
                  <div key={e.id} className="row small" style={{ padding: '2px 0' }}>
                    <span aria-hidden style={{ width: 20 }}>
                      {KIND_ICON[e.kind]}
                    </span>
                    <span className="grow">{e.title}</span>
                    <span className="muted tiny">{e.allDay ? 'ganztägig' : formatTime(new Date(e.start))}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ferien in Brandenburg" icon="🏖️">
        {report.holidays.current || report.holidays.next ? (
          <p className="strong" style={{ marginTop: 0 }}>
            {holidayMessage(data.holidays.periods, now).title.replace('🏖️ ', '')}
          </p>
        ) : null}
        <ul className="list">
          {ferien.slice(0, 8).map((p) => (
            <li key={p.start} className="row small">
              <span className="grow">
                {p.name}
                {!isRealFerien(p) && <span className="muted"> (einzelner Tag)</span>}
              </span>
              <span className="muted">
                {formatShort(p.start)}
                {periodLength(p) > 1 && ` – ${formatShort(p.end)}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          Quelle: {data.holidays.source === 'online' ? 'OpenHolidays API (aktuell)' : 'eingebaute Termine des MBJS'}.{' '}
          {holidayDates.length > 0 && `Nächste Ferien-Updates: ${holidayDates.map((k) => formatShort(k)).join(', ')}.`}
        </p>
      </Card>
    </>
  );
}
