export type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

export interface Order {
  id: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string | null;
  status: OrderStatus;
  notes: string | null;
  source_document_name: string | null;
  extraction_confidence: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  items: Order[];
  total: number;
  limit: number;
  offset: number;
}

export interface OrderCreate {
  patient_first_name: string;
  patient_last_name: string;
  patient_dob?: string | null;
  status?: OrderStatus;
  notes?: string | null;
}

export interface OrderUpdate {
  patient_first_name?: string;
  patient_last_name?: string;
  patient_dob?: string | null;
  status?: OrderStatus;
  notes?: string | null;
}

export interface PatientExtraction {
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  confidence: "high" | "medium" | "low" | string;
  source: string;
}

export interface ExtractionResponse {
  extracted: PatientExtraction;
  raw_text_preview: string;
  order_id: string | null;
}

export interface ActivityLog {
  id: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  actor: string | null;
  client_ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ActivityLogListResponse {
  items: ActivityLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiError {
  error: {
    type: string;
    message: string;
    status_code: number;
    details?: unknown;
    request_id?: string;
  };
}
