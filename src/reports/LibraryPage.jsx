import { useState } from 'react';
import {
  Table,
  TableRow,
  TableCell,
  TableHead,
  TableBody,
  Typography,
  Link,
  Chip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';
import TableShimmer from '../common/components/TableShimmer';

/**
 * My reports: the files WLAB has delivered to this account (LibraryResource).
 *
 * OURS (docs/REPORTING.md, "Library"). Only files an administrator granted to
 * this account are listed - nothing is inferred from which devices it can see.
 * A PDF opens in a new tab; anything else downloads. Withdrawn files are not
 * listed.
 */

const size = (bytes) => {
  if (bytes == null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const date = (item) => {
  const value = item.issued || item.created;
  if (!value) return '';
  return new Date(item.issued ? `${item.issued}T12:00:00Z` : value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const icon = (item) => {
  if (item.contentType === 'application/pdf') return <PictureAsPdfIcon fontSize="small" />;
  if (/sheet|csv/.test(item.contentType)) return <TableChartIcon fontSize="small" />;
  return <InsertDriveFileIcon fontSize="small" />;
};

const KIND_LABEL = { report: 'Report', evidence: 'Evidence', data: 'Data', other: 'File' };

const LibraryPage = () => {
  const [items, setItems] = useState(null);

  useAsyncTask(async ({ signal }) => {
    const response = await fetchOrThrow('/api/library', { signal });
    setItems(await response.json());
  }, []);

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'My reports']}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Report</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Issued</TableCell>
            <TableCell>Size</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items === null && <TableShimmer columns={5} />}
          {items &&
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Link
                    href={`/api/library/${item.id}/file`}
                    target={item.contentType === 'application/pdf' ? '_blank' : undefined}
                    rel="noopener"
                    underline="hover"
                    style={{ display: 'flex', width: 'fit-content', alignItems: 'center', gap: 6 }}
                  >
                    {icon(item)}
                    {item.title}
                  </Link>
                  {item.note && (
                    <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.25, pl: '26px' }}>
                      {item.note}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{item.event || ''}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={KIND_LABEL[item.kind] || item.kind}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{date(item)}</TableCell>
                <TableCell>{size(item.size)}</TableCell>
              </TableRow>
            ))}
          {items && !items.length && (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography variant="body2" color="textSecondary">
                  No reports currently
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </PageLayout>
  );
};

export default LibraryPage;
