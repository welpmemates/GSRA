import Dashboard from "./pages/Dashboard";
import Compare   from "./pages/Compare";
import Report    from "./pages/Report";
import Settings  from "./pages/Settings";
import ToastList from "./components/ui/Toast";
import useStore   from "./store/useStore";

const PAGES = {
  dashboard: Dashboard,
  compare:   Compare,
  report:    Report,
  settings:  Settings,
};

export default function App() {
  const { page } = useStore();
  const Page = PAGES[page] ?? Dashboard;

  return (
    <>
      <Page />
      <ToastList />
    </>
  );
}
