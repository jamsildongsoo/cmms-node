import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import axiosInstance from '../api/axios';
import { User, Mail, Phone, Briefcase, Lock, Save, Shield } from 'lucide-react';

export default function MyPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [title, setTitle] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      axiosInstance.get('/auth/me')
        .then(res => {
          const data = res.data;
          setName(data.name || '');
          setEmail(data.email || '');
          setPhone(data.phone || '');
          setPosition(data.position || '');
          setTitle(data.title || '');
        })
        .catch(err => {
          console.error('Failed to load profile', err);
        });
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      await axiosInstance.put('/auth/me', {
        name,
        email,
        phone,
        position,
        title
      });
      updateUser({ name, position, title });
      setMessage({ type: 'success', text: '프로필 정보가 수정되었습니다.' });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || '프로필 수정에 실패했습니다.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 비밀번호 필드를 입력하세요.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }
    setPasswordLoading(true);
    setMessage(null);
    try {
      await axiosInstance.put('/auth/me/password', {
        currentPassword,
        newPassword
      });
      setMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const errMsg = err.response?.data?.message || '비밀번호 변경에 실패했습니다. 현재 비밀번호를 확인하세요.';
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Shield size={24} className="text-blue-500" />
          내 정보 관리 (My Page)
        </h1>
        <p className="text-slate-400 text-sm mt-1">개인 프로필 정보를 조회 및 수정하고 비밀번호를 변경할 수 있습니다.</p>
      </div>

      {message && (
        <div className="mb-6 p-4 rounded-lg border border-slate-800 bg-slate-900 text-sm text-center text-slate-200 flex items-center justify-center gap-2">
          {message.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-500 mb-4 shadow-inner">
            <User size={48} />
          </div>
          <h2 className="text-lg font-bold text-slate-100">{name}</h2>
          <p className="text-xs text-slate-400 mt-1">{user.id} ({user.companyId})</p>
          <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/50 border border-blue-900/50 text-blue-400 uppercase tracking-wider">
            {user.roleId}
          </div>
          <div className="w-full border-t border-slate-800/60 my-5"></div>
          <div className="w-full space-y-2.5 text-left text-xs text-slate-400">
            <div className="flex justify-between">
              <span>회사코드:</span>
              <span className="font-semibold text-slate-200">{user.companyId}</span>
            </div>
            <div className="flex justify-between">
              <span>부서코드:</span>
              <span className="font-semibold text-slate-200">{user.departmentId || '기본부서'}</span>
            </div>
            <div className="flex justify-between">
              <span>직급:</span>
              <span className="font-semibold text-slate-200">{position || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>직책:</span>
              <span className="font-semibold text-slate-200">{title || '-'}</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <User size={16} className="text-slate-400" />
              기본 정보 수정
            </h3>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* 1행: 사용자 이름 */}
              <div>
                <label className="block text-slate-400 text-xs mb-1.5 font-medium">사용자 이름</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
                />
              </div>

              {/* 2행: 전화번호, 이메일 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">전화번호</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-600">
                      <Phone size={14} />
                    </div>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-8 pr-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">이메일 주소</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-600">
                      <Mail size={14} />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-8 pr-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* 3행: 직급, 직책 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">직급</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-600">
                      <Briefcase size={14} />
                    </div>
                    <input
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-8 pr-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">직책</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-600">
                      <Briefcase size={14} />
                    </div>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 pl-8 pr-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  {isLoading ? '저장 중...' : '정보 저장'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
              <Lock size={16} className="text-slate-400" />
              비밀번호 변경
            </h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-400 text-xs mb-1.5 font-medium">현재 비밀번호</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">새 비밀번호</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1.5 font-medium">새 비밀번호 확인</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 rounded-lg py-2 px-4 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Lock size={14} />
                  {passwordLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
