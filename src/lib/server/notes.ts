import type { D1Database } from '@cloudflare/workers-types';
import { publicUrl } from './photos';

/** Newest-first notes returned per list request. */
export const NOTES_LIMIT = 30;
/** Max characters kept from a note's text. */
export const NOTE_TEXT_MAX = 80;

/** A row in the `notes` table. Timestamps are epoch millis. */
export interface NoteRow {
	id: string;
	r2_key: string;
	text: string;
	created_at: number;
}

export interface NoteResponse {
	id: string;
	url: string;
	text: string;
	createdAt: number;
}

/**
 * Clean a submitted note text: drop control characters, collapse whitespace,
 * trim, and cap the length. Returns '' when nothing usable remains.
 */
export function sanitizeNoteText(raw: FormDataEntryValue | null): string {
	if (typeof raw !== 'string') return '';
	// Drop ASCII control characters (incl. newlines/tabs and DEL), collapse
	// whitespace, trim, then cap the length.
	const cleaned = Array.from(raw)
		.map((ch) => {
			const code = ch.charCodeAt(0);
			return code < 0x20 || code === 0x7f ? ' ' : ch;
		})
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
	return cleaned.slice(0, NOTE_TEXT_MAX);
}

export function toNoteResponse(row: NoteRow, base: string): NoteResponse {
	return {
		id: row.id,
		url: publicUrl(base, row.r2_key),
		text: row.text,
		createdAt: row.created_at
	};
}

export async function insertNote(db: D1Database, note: NoteRow): Promise<void> {
	await db
		.prepare('INSERT INTO notes (id, r2_key, text, created_at) VALUES (?, ?, ?, ?)')
		.bind(note.id, note.r2_key, note.text, note.created_at)
		.run();
}

/** Latest notes, newest-first. */
export async function listNotes(db: D1Database, base: string): Promise<NoteResponse[]> {
	const rows = (
		await db
			.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT ?')
			.bind(NOTES_LIMIT)
			.all<NoteRow>()
	).results;
	return rows.map((row) => toNoteResponse(row, base));
}
