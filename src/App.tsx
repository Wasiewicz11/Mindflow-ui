import { DesignBook } from './views/DesignBook';
import { AppShell } from './app/AppShell';

export default function App() {
  if (window.location.search.includes('design')) {
    return <DesignBook />;
  }

  return <AppShell />;
}
