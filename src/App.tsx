import { DesignBook } from './views/DesignBook';
import { AppShell } from './app/AppShell';
import { ConfirmDialogProvider } from './shared/ui/ConfirmDialogProvider';

export default function App() {
  const content = window.location.search.includes('design') ? <DesignBook /> : <AppShell />;

  return <ConfirmDialogProvider>{content}</ConfirmDialogProvider>;
}
