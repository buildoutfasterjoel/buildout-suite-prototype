import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@buildoutinc/blueprint-react/ui/Badge";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelopeCircleCheck,
  faClock,
  faPencil,
} from "@fortawesome/pro-regular-svg-icons";
import type { Email } from "#/data/emails";

interface Props {
  emails: Email[];
  month: Date;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isoDate(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function EmailBadge({ email }: { email: Email }) {
  const icon =
    email.status === "sent"
      ? faEnvelopeCircleCheck
      : email.status === "scheduled"
        ? faClock
        : faPencil;

  if (email.status === "sent") {
    return (
      <Link to="/email/$emailId" params={{ emailId: email.id }}>
        <Badge className="bg-success justify-content-start w-100">
          <FontAwesomeIcon icon={icon} /> {email.campaign}
        </Badge>
      </Link>
    );
  }

  if (email.status === "scheduled") {
    return (
      <Badge
        variant="primary"
        appearance="accent"
        className="justify-content-start"
      >
        <FontAwesomeIcon icon={icon} /> {email.campaign}
      </Badge>
    );
  }

  return (
    <Badge
      variant="primary"
      appearance="muted"
      className="justify-content-start"
    >
      <FontAwesomeIcon icon={icon} /> {email.campaign}
    </Badge>
  );
}

export function EmailsCalendar({ emails, month }: Props) {
  const { weeks, emailsByDate } = useMemo(() => {
    const year = month.getFullYear();
    const mon = month.getMonth();

    // Build a map of ISO date → emails
    const byDate = new Map<string, Email[]>();
    for (const e of emails) {
      const existing = byDate.get(e.calendarDate) ?? [];
      existing.push(e);
      byDate.set(e.calendarDate, existing);
    }

    // First day of the month and how many days it has
    const firstDay = new Date(year, mon, 1);
    const lastDay = new Date(year, mon + 1, 0);

    // Fill the grid: start from the Sunday before (or on) the 1st
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // End on the Saturday after (or on) the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

    // Build weeks array
    const weeksArr: Date[][] = [];
    const cur = new Date(startDate);
    while (cur <= endDate) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeksArr.push(week);
    }

    return { weeks: weeksArr, emailsByDate: byDate, firstDay, lastDay };
  }, [emails, month]);

  const year = month.getFullYear();
  const mon = month.getMonth();

  const today = isoDate(new Date());
  const allDays = weeks.flat();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: "0.5rem",
        width: "100%",
      }}
    >
      {allDays.map((day, idx) => {
        const wi = Math.floor(idx / 7);
        const di = idx % 7;
        {
          const isCurrentMonth = day.getMonth() === mon;
          const iso = isoDate(day);
          const isToday = iso === today;
          const dayEmails = emailsByDate.get(iso) ?? [];
          const visible = dayEmails.slice(0, 2);
          const overflow = dayEmails.length - visible.length;
          const isFirstRow = wi === 0;

          return (
            <div
              key={idx}
              className={`border rounded overflow-hidden d-flex flex-column${isToday ? " bg-accent bg-opacity-10" : ""}`}
              style={{ height: 110 }}
            >
              {/* Day header */}
              <div className="d-flex align-items-center px-2 pt-2 pb-1 gap-1 flex-shrink-0">
                {isFirstRow && (
                  <span className="fw-semibold">{WEEK_DAYS[di]}</span>
                )}
                <span
                  className={`ms-auto fw-semibold ${isCurrentMonth ? "text-body-secondary" : "text-muted opacity-50"}`}
                >
                  {wi === 0 && day.getMonth() !== mon
                    ? `${MONTH_NAMES[day.getMonth()].slice(0, 3)} ${day.getDate()}`
                    : wi === weeks.length - 1 && day.getMonth() !== mon
                      ? `${MONTH_NAMES[day.getMonth()].slice(0, 3)} ${day.getDate()}`
                      : day.getDate()}
                </span>
              </div>

              {/* Badges */}
              <div className="d-flex justify-content-end flex-column flex-grow-1 gap-1 px-2 pb-2 overflow-hidden">
                {visible.map((e) => (
                  <EmailBadge key={e.id} email={e} />
                ))}
                {overflow > 0 && (
                  <span className="text-muted fs-small">+{overflow} more</span>
                )}
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}
