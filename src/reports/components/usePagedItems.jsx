// OURS, not upstream. Sorting and client-side paging for report tables (REPORTING.md: every list
// is paged; click a column header to sort, click again to reverse).
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { TableCell, TablePagination, TableSortLabel } from '@mui/material';
import usePersistedState from '../../common/util/usePersistedState';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

const isMissing = (value) => value === null || value === undefined || value === '';

const compareValues = (a, b) => {
  if (isMissing(a) || isMissing(b)) {
    return isMissing(a) - isMissing(b);
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return collator.compare(String(a), String(b));
};

/**
 * Sorts by the clicked column. Values come from item[key], then item.attributes[key]; the device
 * column ('deviceId') sorts by device name. Missing values always go last.
 */
export const useSortedItems = (items, key) => {
  const devices = useSelector((state) => state.devices.items);
  const [sort, setSort] = usePersistedState(`${key}Sort`, { by: null, desc: false });

  const sortedItems = useMemo(() => {
    if (!sort.by) {
      return items;
    }
    const value = (item) => {
      if (sort.by === 'deviceId') {
        return devices[item.deviceId]?.name;
      }
      const direct = item[sort.by];
      if (direct !== undefined) {
        return direct;
      }
      if (sort.by === 'type' && item.role) {
        return item.role;
      }
      return item.attributes?.[sort.by];
    };
    const sign = sort.desc ? -1 : 1;
    return [...items].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const missing = isMissing(va) - isMissing(vb);
      return missing || sign * compareValues(va, vb);
    });
  }, [items, sort, devices]);

  const sortCell = (column, label, props = {}) => (
    <TableCell
      key={column}
      sortDirection={sort.by === column ? (sort.desc ? 'desc' : 'asc') : false}
      {...props}
    >
      <TableSortLabel
        active={sort.by === column}
        direction={sort.by === column && sort.desc ? 'desc' : 'asc'}
        onClick={() =>
          setSort(
            sort.by === column ? { by: column, desc: !sort.desc } : { by: column, desc: false },
          )
        }
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return [sortedItems, sortCell];
};

const usePagedItems = (items, key) => {
  const [sortedItems, sortCell] = useSortedItems(items, key);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = usePersistedState(`${key}RowsPerPage`, 50);

  useEffect(() => setPage(0), [items]);

  const pagedItems = useMemo(
    () => sortedItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
    [sortedItems, page, rowsPerPage],
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

  return [pagedItems, pagination, sortCell];
};

export default usePagedItems;
