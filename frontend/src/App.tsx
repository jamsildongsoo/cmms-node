import { Toaster } from 'sonner';
import { useAuthStore } from './store/useAuthStore';
import { useThemeStore } from './store/useThemeStore';
import Login from './pages/Login';
import AppShell from './pages/AppShell';
import SystemShell from './pages/SystemShell';
import UserActionDialogHost from './components/UserActionDialog';

function App() {
  const token = useAuthStore((state) => state.token);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isLight = useThemeStore((state) => state.isLight);
  const user = useAuthStore((state) => state.user);

  if (!isInitialized) return null;

  return (
    <>
      <Toaster theme={isLight ? 'light' : 'dark'} position="top-right" richColors />
      <UserActionDialogHost />
      {token ? (
        user?.companyId === 'SYSTEM' && user.roleId.toUpperCase() === 'SYSTEM'
          ? <SystemShell />
          : <AppShell />
      ) : <Login />}
    </>
  );
}

export default App;
