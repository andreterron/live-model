import { useParams } from 'react-router';

import { ExplorerEntryPage } from '../pages/explorer-entry-page.js';

export default function ExplorerEntryRoute() {
  const { id = '' } = useParams();
  return <ExplorerEntryPage entryId={id} />;
}
