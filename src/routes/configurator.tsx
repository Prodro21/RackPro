import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MainContent } from '../components/MainContent';

export function ConfiguratorRoute() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <Header />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}
