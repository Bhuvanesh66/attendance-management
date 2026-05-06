export function Table({ columns, rows, getRowKey, empty, dense = false }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="ui-table__empty">
        {empty || <span className="ui-muted">No records yet.</span>}
      </div>
    );
  }
  return (
    <div className="ui-table-wrap">
      <table className={`ui-table ${dense ? "ui-table--dense" : ""}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const key = getRowKey ? getRowKey(row, i) : row.id ?? i;
            return (
              <tr key={key}>
                {columns.map((c) => (
                  <td key={c.key} className={c.mono ? "ui-table__mono" : ""}>
                    {c.render ? c.render(row) : row[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
