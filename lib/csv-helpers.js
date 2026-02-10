export const toCsvValue = (value) => {
  if (value === null || value === undefined) return '""';
  const stringValue = String(value).replace(/"/g, '""');
  return `"${stringValue}"`;
};

export const buildCsv = (headers, rows) => {
  const headerLine = headers.map(toCsvValue).join(',');
  const lines = rows.map((row) => row.map(toCsvValue).join(','));
  return [headerLine, ...lines].join('\n');
};

export const sendCsv = (res, filename, headers, rows) => {
  const csv = buildCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.status(200).send(csv);
};

export default {
  toCsvValue,
  buildCsv,
  sendCsv,
};
