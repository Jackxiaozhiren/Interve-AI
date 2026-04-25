export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  loginTime: number;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userData: Omit<User, 'loginTime'>) => Promise<void>;
  logout: () => Promise<void>;
}
