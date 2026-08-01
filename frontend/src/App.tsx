import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import Login from './pages/Login';
import AppShell from './pages/AppShell';
import UserActionDialogHost from './components/UserActionDialog';

function App() {
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLight = useThemeStore((state) => state.isLight);

  if (!isInitialized) return null;

  return (
    <>
      <Toaster theme={isLight ? 'light' : 'dark'} position="top-right" richColors />
      <UserActionDialogHost />
      {token ? <AppShell /> : <Login />}
    </>
  );
}

export default App;
