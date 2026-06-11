function parseDateText(raw) {
  const value = raw.trim().replace(/\//g, "-");
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) {
    throw new Error("日期格式不正确，请使用 YYYY-MM-DD");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("日期无效");
  }

  return { year, month, day };
}

function parseTimeText(raw) {
  const value = raw.trim();
  const match = value.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!match) {
    throw new Error("时间格式不正确，请使用 HH:mm:ss");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error("时间无效");
  }

  return { hour, minute, second };
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateText(parts) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function formatTimeText(parts) {
  return `${pad2(parts.hour)}:${pad2(parts.minute)}:${pad2(parts.second)}`;
}
