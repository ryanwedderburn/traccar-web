// OURS, not upstream. Client-side paging for report tables (REPORTING.md: every list is paged).
// Returns the rows of the current page and the pagination control to render under the table.
import { useEffect, useMemo, useState } from 'react';
import { TablePagination } from '@mui/material';
import usePersistedState from '../../common/util/usePersistedState';

const usePagedItems = (items, key) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = usePersistedState(`${key}RowsPerPage`, 50);

  useEffect(() => setPage(0), [items]);

  const pagedItems = useMemo(
    () => items.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [items, page, rowsPerPage],
  );

  const pagination = items.length ? (
    <TablePagination
      component="div"
      count={items.length}
      page={Math.min(page, Math.max(0, Math.ceil(items.length / rowsPerPage) - 1))}
      onPageChange={(event, value) => setPage(value)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
      }}
      rowsPerPageOptions={[25, 50, 100, 200]}
    />
  ) : null;

  return [pagedItems, pagination];
};

export default usePagedItems;
