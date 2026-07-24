import { useEffect, useState } from 'react';
import {
  registerUserActionDialog,
  type DialogRequest,
} from '../utils/userActionDialog';

export default function UserActionDialogHost() {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    registerUserActionDialog((next) => {
      setValue(next.kind === 'text' ? next.initialValue || '' : '');
      setRequest(next);
    });
    return () => {
      registerUserActionDialog(null);
    };
  }, []);

  if (!request) return null;

  const cancel = () => {
    if (request.kind === 'confirm') request.resolve(false);
    else request.resolve(null);
    setRequest(null);
  };

  const submit = () => {
    if (request.kind === 'confirm') request.resolve(true);
    else request.resolve(value.trim() || null);
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
      >
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{request.message}</p>
        {request.kind === 'text' && (
          <input
            autoFocus
            type="text"
            value={value}
            placeholder={request.placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
              if (event.key === 'Escape') cancel();
            }}
            className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
          />
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className="rounded-md border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-md border-0 bg-blue-600 px-4 py-2 text-xs font-semibold text-white cursor-pointer"
          >
            {request.confirmLabel || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
