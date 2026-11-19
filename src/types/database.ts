export type Division =
  | 'Publikasi dan Sosialisasi'
  | 'Lingkungan Hidup'
  | 'Pendidikan'
  | 'Pengabdian Masyarakat'
  | 'Kewirausahaan'
  | 'BPH';

export type Role = 'superadmin' | 'admin' | 'kadiv' | 'member';

export type EventCategory = 'Wajib' | 'Proker' | 'Rutin';

export type AttendanceStatus = 'hadir' | 'izin' | 'alfa' | 'delegasi';

export type EvaluationPredicate = 'Sangat Aktif' | 'Aktif' | 'Perlu Pembinaan' | 'Anggota Baru';

export interface Profile {
  id: string; // UUID relasi ke auth.users
  npm: string;
  nim?: string;
  email: string | null;
  full_name: string;
  division: Division;
  role: Role;
  phone?: string | null;
  study_program?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_activated?: boolean;
  created_at: string;
}

export interface ProfileInsert {
  id: string;
  npm?: string;
  nim?: string;
  email?: string | null;
  full_name: string;
  division: Division;
  role?: Role;
  phone?: string | null;
  study_program?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_activated?: boolean;
  created_at?: string;
}

export interface ProfileUpdate {
  npm?: string;
  nim?: string;
  email?: string | null;
  full_name?: string;
  division?: Division;
  role?: Role;
  phone?: string | null;
  study_program?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  is_activated?: boolean;
}

export interface Event {
  id: string;
  title: string;
  category: EventCategory;
  event_date: string;
  points: number;
  qr_token: string;
  is_active: boolean;
  require_location?: boolean;
  target_lat?: number | null;
  target_lng?: number | null;
  radius_meters?: number;
  created_by: string | null;
  created_at: string;
}

export interface EventInsert {
  id?: string;
  title: string;
  category: EventCategory;
  event_date: string;
  points?: number;
  qr_token: string;
  is_active?: boolean;
  require_location?: boolean;
  target_lat?: number | null;
  target_lng?: number | null;
  radius_meters?: number;
  created_by?: string | null;
  created_at?: string;
}

export interface EventUpdate {
  title?: string;
  category?: EventCategory;
  event_date?: string;
  points?: number;
  qr_token?: string;
  is_active?: boolean;
  require_location?: boolean;
  target_lat?: number | null;
  target_lng?: number | null;
  radius_meters?: number;
}

export interface Attendance {
  id: string;
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  proof_url: string | null;
  verified: boolean;
  rejection_reason?: string | null;
  user_lat?: number | null;
  user_lng?: number | null;
  scanned_at: string;
}

export interface AttendanceInsert {
  id?: string;
  event_id: string;
  user_id: string;
  status: AttendanceStatus;
  proof_url?: string | null;
  verified?: boolean;
  rejection_reason?: string | null;
  user_lat?: number | null;
  user_lng?: number | null;
  scanned_at?: string;
}

export interface AttendanceUpdate {
  status?: AttendanceStatus;
  proof_url?: string | null;
  verified?: boolean;
  rejection_reason?: string | null;
  user_lat?: number | null;
  user_lng?: number | null;
}

export interface MemberEvaluation {
  user_id: string;
  npm: string;
  nim?: string;
  email: string | null;
  full_name: string;
  division: Division;
  role: Role;
  avatar_url?: string | null;
  total_points: number;
  total_hadir: number;
  total_izin: number;
  total_alfa: number;
  attendance_percentage: number;
  predicate: EvaluationPredicate;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      events: {
        Row: Event;
        Insert: EventInsert;
        Update: EventUpdate;
      };
      attendances: {
        Row: Attendance;
        Insert: AttendanceInsert;
        Update: AttendanceUpdate;
      };
    };
    Views: {
      member_evaluations: {
        Row: MemberEvaluation;
      };
    };
  };
}
