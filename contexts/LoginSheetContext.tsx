import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoginSheetContextType {
  isLoginSheetVisible: boolean;
  setLoginSheetVisible: (visible: boolean) => void;
  showLoginSheet: () => void;
  hideLoginSheet: () => void;
}

const LoginSheetContext = createContext<LoginSheetContextType | undefined>(undefined);

export const useLoginSheet = () => {
  const context = useContext(LoginSheetContext);
  if (!context) {
    throw new Error('useLoginSheet must be used within a LoginSheetProvider');
  }
  return context;
};

interface LoginSheetProviderProps {
  children: ReactNode;
}

export const LoginSheetProvider: React.FC<LoginSheetProviderProps> = ({ children }) => {
  const [isLoginSheetVisible, setIsLoginSheetVisible] = useState(false);

  const setLoginSheetVisible = (visible: boolean) => {
    setIsLoginSheetVisible(visible);
  };

  const showLoginSheet = () => {
    if (!isLoginSheetVisible) {
      setIsLoginSheetVisible(true);
    }
  };

  const hideLoginSheet = () => {
    setIsLoginSheetVisible(false);
  };

  return (
    <LoginSheetContext.Provider
      value={{
        isLoginSheetVisible,
        setLoginSheetVisible,
        showLoginSheet,
        hideLoginSheet,
      }}
    >
      {children}
    </LoginSheetContext.Provider>
  );
};
