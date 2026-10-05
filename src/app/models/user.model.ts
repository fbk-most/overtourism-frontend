export interface AuthMe {
    authenticated: boolean;
    territory: string | null;
    subject: string;
    user_id: string;
    role: 'admin' | 'multieditor' | 'editor' | 'viewer' | string;
    is_global_admin: boolean;
    territories: string[];
  }
  
  export interface AuthRole {
    role: string;
    description: string;
  }
  
  export interface AuthUser {
    user_id: string;
    identifier: string;
    subject?: string;
    role: string;
    is_active: boolean;
    territories: string[];
    created_at?: string;
    updated_at?: string;
  }
  
  export interface CreateAuthUserDto {
    identifier: string;
    role: string;
    territories: string[];
  }
  
  export interface UpdateAuthUserDto {
    role?: string;
    territories?: string[];
    is_active?: boolean;
  }