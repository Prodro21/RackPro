import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { MainContent } from '../components/MainContent';
import { StatusBar } from '../components/StatusBar';

export function ConfiguratorRoute() {
  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header />
        <MainContent />
        <StatusBar />
      </div>
    </div>
  );
}
