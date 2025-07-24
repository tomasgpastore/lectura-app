export interface Command {
  name: string;
  description: string;
  action: () => void | Promise<void>;
  requiresParameter?: boolean;
}

export interface CommandWithParameter extends Command {
  parameterPlaceholder?: string;
  handleParameter?: (param: string) => void | Promise<void>;
}

export const createCommands = (
  handlers: {
    onClearChat: () => void;
    onThemeChange: (theme: 'light' | 'dark') => void;
    onLogout: () => Promise<void>;
    onNavigateToClass: (classId: string) => void;
    onOpenDocument?: (documentId: string) => void;
    onRemoveDocument?: (documentId: string) => void;
    onRenameDocument?: (documentId: string, newName: string) => void;
  }
): CommandWithParameter[] => [
  {
    name: '/clear',
    description: 'Clear the chat history',
    action: handlers.onClearChat,
    requiresParameter: false,
  },
  {
    name: '/theme',
    description: 'Change theme (usage: /theme light or /theme dark)',
    action: () => {}, // Handled by parameter
    requiresParameter: true,
    parameterPlaceholder: 'light or dark',
    handleParameter: (param: string) => {
      const theme = param.trim().toLowerCase();
      if (theme === 'light' || theme === 'dark') {
        handlers.onThemeChange(theme);
      }
    },
  },
  {
    name: '/logout',
    description: 'Log out of your account',
    action: handlers.onLogout,
    requiresParameter: false,
  },
  {
    name: '/cd',
    description: 'Change to a different class (usage: /cd [class name])',
    action: () => {}, // Handled by parameter
    requiresParameter: true,
    parameterPlaceholder: '[class name]',
    handleParameter: (param: string) => {
      // This is handled differently with class suggestions
    },
  },
  {
    name: '/open',
    description: 'Open a document preview (usage: /open [document name])',
    action: () => {}, // Handled by parameter
    requiresParameter: true,
    parameterPlaceholder: '[document name]',
    handleParameter: (param: string) => {
      // This is handled differently with document suggestions
    },
  },
  {
    name: '/remove',
    description: 'Remove a document (usage: /remove [document name])',
    action: () => {}, // Handled by parameter
    requiresParameter: true,
    parameterPlaceholder: '[document name]',
    handleParameter: (param: string) => {
      // This is handled differently with document suggestions
    },
  },
  {
    name: '/rename',
    description: 'Rename a document (usage: /rename [document name] [new name without extension])',
    action: () => {}, // Handled by parameter
    requiresParameter: true,
    parameterPlaceholder: '[document name] [new name without extension]',
    handleParameter: (param: string) => {
      // This is handled differently with document suggestions and additional parameter
    },
  },
];