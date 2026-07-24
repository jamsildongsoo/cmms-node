export type DialogRequest =
  | {
      kind: 'confirm';
      message: string;
      confirmLabel?: string;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'text';
      message: string;
      initialValue?: string;
      placeholder?: string;
      confirmLabel?: string;
      resolve: (value: string | null) => void;
    };

let openDialog: ((request: DialogRequest) => void) | null = null;

export function registerUserActionDialog(handler: ((request: DialogRequest) => void) | null) {
  openDialog = handler;
}

export function requestConfirmation(
  message: string,
  confirmLabel = '확인',
): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(false);
      return;
    }
    openDialog({ kind: 'confirm', message, confirmLabel, resolve });
  });
}

export function requestTextInput(
  message: string,
  options?: { initialValue?: string; placeholder?: string; confirmLabel?: string },
): Promise<string | null> {
  return new Promise((resolve) => {
    if (!openDialog) {
      resolve(null);
      return;
    }
    openDialog({
      kind: 'text',
      message,
      initialValue: options?.initialValue,
      placeholder: options?.placeholder,
      confirmLabel: options?.confirmLabel,
      resolve,
    });
  });
}
