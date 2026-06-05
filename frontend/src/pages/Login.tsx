import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { Building2, User, Lock, Mail, Phone, Briefcase, ChevronRight, Sun, Moon } from 'lucide-react';

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const signUp = useAuthStore((s) => s.signUp);
  const error = useAuthStore((s) => s.error);
  const setError = useAuthStore((s) => s.setError);
  const [isSignUp, setIsSignUp] = useState(false);
  const isLightMode = useThemeStore((s) => s.isLight);
  const toggleTheme = useThemeStore((s) => s.toggle);

  // Login form state
  const [loginCompanyId, setLoginCompanyId] = useState('');
  const [loginUserId, setLoginUserId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(() => {
    return localStorage.getItem('remember_login') === 'true';
  });

  // Load saved credentials on mount
  useEffect(() => {
    const remember = localStorage.getItem('remember_login') === 'true';
    if (remember) {
      const savedCompanyId = localStorage.getItem('saved_company_id');
      const savedUserId = localStorage.getItem('saved_user_id');
      if (savedCompanyId) setLoginCompanyId(savedCompanyId);
      if (savedUserId) setLoginUserId(savedUserId);
    }
  }, []);

  // SignUp form state
  const [signupCompanyId, setSignupCompanyId] = useState('');
  const [signupUserId, setSignupUserId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPosition, setSignupPosition] = useState('');
  const [signupTitle, setSignupTitle] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginCompanyId || !loginUserId || !loginPassword) {
      setError('모든 필드를 채워주세요.');
      return;
    }
    setIsLoading(true);
    const success = await login(loginCompanyId, loginUserId, loginPassword);
    setIsLoading(false);
    if (success) {
      // 비밀번호 변경 안내는 Dashboard의 PasswordChangeNotice 모달이 처리(플래그 기반)
      if (rememberMe) {
        localStorage.setItem('saved_company_id', loginCompanyId);
        localStorage.setItem('saved_user_id', loginUserId);
        localStorage.setItem('remember_login', 'true');
      } else {
        localStorage.removeItem('saved_company_id');
        localStorage.removeItem('saved_user_id');
        localStorage.setItem('remember_login', 'false');
      }
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupCompanyId || !signupUserId || !signupPassword || !signupName) {
      setError('필수 정보를 입력해주세요 (회사 코드, ID, 비밀번호, 이름).');
      return;
    }
    setIsLoading(true);
    try {
      await signUp({
        companyId: signupCompanyId,
        id: signupUserId,
        name: signupName,
        password: signupPassword,
        email: signupEmail,
        phone: signupPhone,
        position: signupPosition,
        title: signupTitle,
      });
      alert('회원가입이 완료되었습니다. 로그인해주세요.');
      setIsSignUp(false);
      // Reset signup fields
      setSignupCompanyId('');
      setSignupUserId('');
      setSignupPassword('');
      setSignupName('');
      setSignupEmail('');
      setSignupPhone('');
      setSignupPosition('');
      setSignupTitle('');
    } catch (err: any) {
      // Error message is handled by store
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      {/* Background Gradients */}
      <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-900/30 rounded-full blur-3xl opacity-30"></div>
      <div className="absolute bottom-0 -right-4 w-96 h-96 bg-blue-900/30 rounded-full blur-3xl opacity-30"></div>

      {/* 테마 토글 버튼 */}
      <button
        onClick={toggleTheme}
        title={isLightMode ? "다크 모드로 전환" : "라이트 모드로 전환"}
        className="absolute top-6 right-6 z-20 flex items-center justify-center p-2.5 bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 rounded-xl text-slate-400 hover:text-slate-200 transition-colors cursor-pointer outline-none backdrop-blur-md shadow-lg"
      >
        {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <div className="w-full max-w-lg p-6 sm:p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 shadow-2xl z-10 mx-4 transition-all duration-300">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 tracking-wider">
            설비관리시스템
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {isSignUp ? '설비관리시스템 회원가입' : '설비관리시스템 로그인'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-800/80 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {!isSignUp ? (
          /* ================= LOGIN FORM ================= */
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                회사 코드 (Tenant ID)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Building2 size={18} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="예: SYSTEM, COMP001"
                  value={loginCompanyId}
                  onChange={(e) => setLoginCompanyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 outline-none text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                사용자 ID
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="아이디를 입력하세요"
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 outline-none text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  placeholder="비밀번호를 입력하세요"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-600 outline-none text-sm transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex items-center space-x-2 text-slate-400 hover:text-slate-300 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-800 bg-slate-950 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-4 h-4"
                />
                <span>회사 코드 및 아이디 저장</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg py-3 font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? '로그인 중...' : '로그인'}</span>
              {!isLoading && <ChevronRight size={16} />}
            </button>


            <div className="text-center mt-6">
              <span className="text-slate-500 text-xs mr-2">아직 계정이 없으신가요?</span>
              <button
                type="button"
                onClick={toggleMode}
                className="text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer underline"
              >
                회원가입
              </button>
            </div>
          </form>
        ) : (
          /* ================= SIGN UP FORM ================= */
          <form onSubmit={handleSignUpSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  회사 코드 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Building2 size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="예: COMP001 (없는 코드면 신규 회사 생성)"
                    value={signupCompanyId}
                    onChange={(e) => setSignupCompanyId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  사용자 ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="아이디 입력"
                    value={signupUserId}
                    onChange={(e) => setSignupUserId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  사용자 이름 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="이름 입력"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="비밀번호 입력"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  이메일
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  전화번호
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Phone size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  직급
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Briefcase size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="예: 사원, 과장"
                    value={signupPosition}
                    onChange={(e) => setSignupPosition(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  직책
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Briefcase size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="예: 팀장, 조장"
                    value={signupTitle}
                    onChange={(e) => setSignupTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-9 pr-3 text-slate-200 placeholder-slate-600 outline-none text-xs transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg py-2.5 font-semibold text-sm transition-all duration-200 shadow-lg shadow-indigo-900/30 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isLoading ? '가입 신청 중...' : '회원가입 신청'}</span>
              {!isLoading && <ChevronRight size={16} />}
            </button>

            <div className="text-center mt-4">
              <span className="text-slate-500 text-xs mr-2">이미 계정이 있으신가요?</span>
              <button
                type="button"
                onClick={toggleMode}
                className="text-blue-400 hover:text-blue-300 text-xs font-semibold cursor-pointer underline"
              >
                로그인으로 돌아가기
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
