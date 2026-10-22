import { useAuth } from '../../../context/AuthContext';
import DiyContentEditor from './DiyContentEditor';
import { loadDiyPageContent, saveDiyPageContent } from './contentService';
export default function DiyContentManagement({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const { user, userRole } = useAuth();
  if (!user || userRole !== 'admin') return <p role="alert">Admin access is required to edit the DIY page.</p>;
  return <DiyContentEditor loadContent={loadDiyPageContent} saveContent={saveDiyPageContent} onDirtyChange={onDirtyChange} />;
}
