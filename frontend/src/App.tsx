import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserActionDialogHost from './components/UserActionDialog';

function App() {
  const token = useAuthStore((state) => state.token);
  const isLight = useThemeStore((state) => state.isLight);

  return (
    <>
      <Toaster theme={isLight ? 'light' : 'dark'} position="top-right" richColors />
      <UserActionDialogHost />
      {token ? <Dashboard /> : <Login />}
    </>
  );
}

export default App;
