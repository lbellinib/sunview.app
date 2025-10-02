const API_PREFIX = '/api/';

const formatDate = (date, timeZone, options = {}) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    ...options,
  });
  return formatter.format(date);
};

const formatDateTime = (isoString, timeZone) => {
  const date = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(date).replace(',', '');
};

const summarizeResults = (rows, timeZone) => {
  if (!rows.length) {
    return {
      total: 0,
      avgDuration: 0,
      firstArrival: null,
      lastArrival: null,
      countByHour: {},
    };
  }
  const durations = [];
  const countByHour = {};
  let firstArrival = null;
  let lastArrival = null;

  for (const row of rows) {
    const arrivalUtc = row.arrival_timestamp_utc
      ? new Date(row.arrival_timestamp_utc)
      : new Date(row.arrival_local);
    const arrivalLocal = new Date(arrivalUtc);
    const arrivalHour = formatDate(arrivalLocal, timeZone, { hour: '2-digit', hour12: false });
    const hourKey = arrivalHour.slice(0, 2);
    countByHour[hourKey] = (countByHour[hourKey] || 0) + 1;

    if (row.departure_timestamp_utc) {
      const departureUtc = new Date(row.departure_timestamp_utc);
      const diffMinutes = Math.max(
        1,
        Math.round((departureUtc.getTime() - arrivalUtc.getTime()) / 60000),
      );
      durations.push(diffMinutes);
    }

    if (!firstArrival || arrivalUtc < firstArrival) {
      firstArrival = arrivalUtc;
    }
    if (!lastArrival || arrivalUtc > lastArrival) {
      lastArrival = arrivalUtc;
    }
  }

  const avgDuration = durations.length
    ? Math.round(durations.reduce((sum, val) => sum + val, 0) / durations.length)
    : 0;

  return {
    total: rows.length,
    avgDuration,
    firstArrival: firstArrival ? firstArrival.toISOString() : null,
    lastArrival: lastArrival ? lastArrival.toISOString() : null,
    countByHour,
  };
};

const buildCsv = (rows, timeZone) => {
  const header = 'ticketUid,plate,arrivalLocal,departureLocal,parkedMinutes,notes';
  const body = rows
    .map((row) => {
      const arrivalFormatted = row.arrival_local
        ? formatDateTime(row.arrival_local, timeZone)
        : formatDateTime(row.arrival_timestamp_utc, timeZone);
      const departureFormatted = row.departure_local
        ? formatDateTime(row.departure_local, timeZone)
        : row.departure_timestamp_utc
          ? formatDateTime(row.departure_timestamp_utc, timeZone)
          : '';
      const parkedMinutes = row.departure_timestamp_utc
        ? Math.max(
            1,
            Math.round(
              (new Date(row.departure_timestamp_utc).getTime() -
                new Date(row.arrival_timestamp_utc).getTime()) /
                60000,
            ),
          )
        : '';
      const escapedNotes = (row.notes || '').replace(/"/g, '""');
      return [
        row.ticket_uid,
        row.plate_number,
        arrivalFormatted,
        departureFormatted,
        parkedMinutes,
        `"${escapedNotes}"`,
      ].join(',');
    })
    .join('\n');
  return body ? `${header}\n${body}` : `${header}\n`;
};

const buildHtml = (rows, summary, timeZone) => {
  const listItems = summary
    ? Object.entries(summary.countByHour)
        .map(([hour, count]) => `<li><strong>${hour}:00</strong> — ${count}</li>`)
        .join('')
    : '';
  const rowsHtml = rows
    .map((row) => {
      const arrival = row.arrival_local
        ? formatDateTime(row.arrival_local, timeZone).split(' ')[1]
        : formatDateTime(row.arrival_timestamp_utc, timeZone).split(' ')[1];
      const departure = row.departure_timestamp_utc
        ? formatDateTime(row.departure_timestamp_utc, timeZone).split(' ')[1]
        : '—';
      const duration = row.departure_timestamp_utc
        ? Math.max(
            1,
            Math.round(
              (new Date(row.departure_timestamp_utc).getTime() -
                new Date(row.arrival_timestamp_utc).getTime()) /
                60000,
            ),
          )
        : '—';
      return `<tr><td>${row.ticket_uid}</td><td>${row.plate_number}</td><td>${arrival}</td><td>${departure}</td><td>${duration}</td><td>${row.notes || ''}</td></tr>`;
    })
    .join('');
  const firstArrival =
    summary && summary.firstArrival ? formatDateTime(summary.firstArrival, timeZone) : 'N/A';
  const lastArrival =
    summary && summary.lastArrival ? formatDateTime(summary.lastArrival, timeZone) : 'N/A';
  return `
  <h2>Daily Valet Summary</h2>
  <p>Total vehicles: <strong>${summary ? summary.total : 0}</strong></p>
  <p>Average duration: <strong>${summary ? summary.avgDuration : 0} minutes</strong></p>
  <p>First arrival: ${firstArrival}</p>
  <p>Last arrival: ${lastArrival}</p>
  <h3>Arrivals by hour</h3>
  <ul>${listItems}</ul>
  <table border="1" cellpadding="6" cellspacing="0">
    <thead>
      <tr><th>Ticket</th><th>Plate</th><th>Arrival</th><th>Departure</th><th>Minutes</th><th>Notes</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  `;
};

const deliverReport = async (env, dateISO, report) => {
  if (!env.API_ORIGIN || !env.CRON_SECRET) {
    console.log('Missing API_ORIGIN or CRON_SECRET; cannot deliver report payload.');
    return;
  }
  const endpoint = new URL('/api/system/reports/daily', env.API_ORIGIN);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cron-key': env.CRON_SECRET,
    },
    body: JSON.stringify({ date: dateISO, report: { csv: report.csv, html: report.html } }),
  });
  if (!response.ok) {
    console.error('Worker report delivery failed', response.status, await response.text());
  }
};

const generateReportFromD1 = async (env, dateISO) => {
  if (!env.VALET_D1) {
    return null;
  }
  const tz = env.HOTEL_TZ || 'America/New_York';
  const dayStart = `${dateISO}T00:00:00`;
  const dayEnd = `${dateISO}T23:59:59.999`;
  const statement = env.VALET_D1.prepare(
    `SELECT ticket_uid, plate_number, arrival_local, arrival_timestamp_utc, departure_local, departure_timestamp_utc, notes FROM valet_records WHERE arrival_local BETWEEN ? AND ? ORDER BY arrival_timestamp_utc ASC`,
  );
  const { results } = await statement.bind(dayStart, dayEnd).all();
  const rows = results || [];
  const summary = summarizeResults(rows, tz);
  const csv = buildCsv(rows, tz);
  const html = buildHtml(rows, summary, tz);
  return { rows, summary, csv, html };
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith(API_PREFIX)) {
      if (!env.API_ORIGIN) {
        return new Response(JSON.stringify({ error: 'API origin not configured' }), {
          status: 503,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }
      const targetUrl = new URL(url.pathname + url.search, env.API_ORIGIN);
      const init = {
        method: request.method,
        headers: new Headers(request.headers),
        redirect: 'manual',
      };
      if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
        init.body = await request.clone().arrayBuffer();
      }
      init.headers.set('host', targetUrl.host);
      const proxyRequest = new Request(targetUrl.toString(), init);
      return fetch(proxyRequest, { cf: { cacheTtl: 0 } });
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === 'GET') {
      const indexRequest = new Request(new URL('/', request.url), {
        method: 'GET',
        headers: request.headers,
      });
      return env.ASSETS.fetch(indexRequest);
    }

    return assetResponse;
  },

  async scheduled(event, env) {
    const tz = env.HOTEL_TZ || 'America/New_York';
    const scheduledAt = event.scheduledTime ? new Date(event.scheduledTime) : new Date();
    const localDate = formatDate(scheduledAt, tz, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    if (env.VALET_D1) {
      try {
        const report = await generateReportFromD1(env, localDate);
        await deliverReport(env, localDate, report);
        return;
      } catch (error) {
        console.error('Failed to generate Worker report from D1', error);
      }
    }
    if (env.API_ORIGIN && env.CRON_SECRET) {
      const endpoint = new URL('/api/system/reports/daily', env.API_ORIGIN);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-cron-key': env.CRON_SECRET,
        },
        body: JSON.stringify({ date: localDate }),
      });
      if (!response.ok) {
        console.error('Fallback report trigger failed', response.status, await response.text());
      }
      return;
    }
    console.log('Scheduled report skipped: missing API_ORIGIN/CRON_SECRET or D1 binding.');
  },
};
