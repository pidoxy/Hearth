export type ItemKind = "event" | "deadline" | "task";
export type ItemStatus = "proposed" | "accepted" | "dismissed";
export type CaptureStatus = "processing" | "done" | "failed" | "unverified";
export type CaptureSource = "upload" | "paste" | "email";

export interface Household {
  id: string;
  name: string;
  timezone: string;
  inbound_code: string;
  ics_token: string;
  digest_enabled: number;
  allowed_senders: string;
  created_at: string;
}

export interface Person {
  id: string;
  household_id: string;
  name: string;
  color: string;
  ics_token: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  household_id: string | null;
  person_id: string | null;
}

export interface Capture {
  id: string;
  household_id: string;
  created_by: string | null;
  source: CaptureSource;
  title: string;
  text_content: string | null;
  file_path: string | null;
  file_mime: string | null;
  file_name: string | null;
  email_from: string | null;
  doc_date: string;
  status: CaptureStatus;
  error: string | null;
  extractor: string | null;
  created_at: string;
}

export interface Item {
  id: string;
  household_id: string;
  capture_id: string | null;
  kind: ItemKind;
  title: string;
  /** "YYYY-MM-DD" when all_day, otherwise local wall time "YYYY-MM-DDTHH:mm" in the household timezone. */
  start: string;
  end: string | null;
  all_day: number;
  location: string | null;
  notes: string | null;
  needs_prep: number;
  prep_note: string | null;
  confidence: number;
  source_quote: string | null;
  status: ItemStatus;
  done: number;
  assignee_id: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemWithPeople extends Item {
  people: string[]; // person ids the item is "for"
}

/** What an extractor returns, before it is resolved against the household. */
export interface ExtractedItem {
  kind: ItemKind;
  title: string;
  start: string;
  end: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  for_people: string[];
  needs_prep: boolean;
  prep_note: string | null;
  confidence: number;
  source_quote: string | null;
}
