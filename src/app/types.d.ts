import {BehaviorSubject} from 'rxjs';
import {Theme} from './settings.service';
import CodeMirror from 'codemirror';

declare interface NoteFile {
  title: string; // Maps to file name when exported
  content: string;
  lastChangedEpochMillis?: number; // Doesn't exist if the file hasn't been commited yet
  // lastChanged?: FirebaseTimestamp; // Doesn't exist if the file hasn't been commited yet
}

declare interface NoteObject extends NoteFile {
  id: string;
}

declare interface ParentTagToChildTags {
  [tag: string]: string[];
}

declare interface TagGroup {
  tag: string;
  noteIds: string[];
  newestNoteChangeTimestamp: number;
}

interface TagNesting {
  oldParentTag: string;
  newParentTag: string;
  childTag: string;
}

interface NoteDrag {
  noteTitle: string;
  sourceTag: string;
  targetTag: string;
}

declare interface FileMetadata {
  id: string;
  title: string;
  mimeType: string;
  lastChangedEpochMillis: number;
  createdEpochMillis: number;
}

declare interface FirebaseTimestamp {
  seconds: number;
  nanos: number;
}

declare interface NoteAndLinks {
  noteTitle: string;
  connectedTo: string[];
  lastChanged: number;
}

interface SearchResult {
  titleSegments: FormattedSegment[];
  contentSegments: FormattedSegment[][];
  numContentMatches: number;
  noteId: string;
}

interface FormattedSegment {
  text: string;
  highlighted: boolean;
}

interface RenameResult {
  renamedBackRefCount: number;
  renamedNoteCount: number;
  status: Promise<any>;
}

interface MessageStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  message: string; // Actual message to be displayed to the user
}

interface BackendStatusNotification {
  id: string; // A notification can be overwritten by sending another notification with the same ID
  message: string; // Actual message to be displayed to the user
}

interface UserSettings {
  theme?: Theme;
  ignoredTags?: string[];
  analyticsEnabled?: boolean;
}

interface AttachmentMetadata {
  [noteId: string]: AttachedFile[];
}

interface AttachedFile {
  // The name should be viable
  name: string;
  fileId: string;
  mimeType: string;
}

interface Flashcard {
  id?: string; // Not set if unsaved
  createdEpochMillis?: number; // Not set if unsaved
  lastChangedEpochMillis?: number; // Not set if unsaved
  // Only for debugging - this might not reflect the actual next repetition time if
  // user has changed some settings (like initial delay period) after this was calculated
  nextRepetitionEpochMillis?: number;
  tags: string[];
  side1: string;
  side2: string;
  isTwoWay: boolean;
  learningData: FlashcardLearningData;
  noteTitle?: string; // The note that was active when this was created - not always populated for early versions
}

interface FlashcardLearningData {
  easinessFactor: number;
  numRepetitions: number;
  prevRepetitionIntervalMillis: number;
  prevRepetitionEpochMillis: number;
}

// Rule for extracting a flashcard suggestion from text
interface FlashcardSuggestionExtractionRule {
  start: RegExp;
  isStartInclusive?: boolean; // Defaults to false
  end: RegExp;
  isEndInclusive?: boolean; // Defaults to false
  description?: string;
}

interface FlashcardSuggestion {
  text: string;
  start: CodeMirror.Position;
  end: CodeMirror.Position;
}

export enum TextHidingLogic {
  HIDE_EVERYTHING_TO_RIGHT,
  HIDE_EVERYTHING_TO_LEFT,
  HIDE_MATCHING_ONLY,
}

interface FlashcardTextHidingRule {
  matcher: RegExp;
  hidingLogic: TextHidingLogic[];
}

interface NoteTitleChanged {
  oldTitle: string;
  newTitle: string;
}

interface TagNameChanged {
  oldTag: string;
  newTag: string;
  affectedNoteIds?: string[]; // If unset, all notes are affected
}

interface StorageBackend {
  // These contain the latest notes/flashcards/etc and are synced with the backend
  notes: BehaviorSubject<NoteObject[]>;
  flashcards: BehaviorSubject<Flashcard[]>;
  attachedFiles: BehaviorSubject<AttachedFile[]>;
  storedSettings: BehaviorSubject<UserSettings>;
  nestedTagGroups: BehaviorSubject<ParentTagToChildTags>;

  shouldUseThisBackend(): Promise<boolean>;
  initialize(): Promise<void>;

  createNote(title: string): Promise<FileMetadata>;
  // Updates the title and/or content of the note (update is only performed if the value is truthy).
  updateNote(noteId: string, title: string|null, content: string|null): Promise<void>;
  deleteNote(noteId): Promise<void>;

  createFlashcard(fc: Flashcard): Promise<FileMetadata>;
  updateFlashcard(fc: Flashcard): Promise<void>;
  deleteFlashcard(fcId: string): Promise<void>;

  uploadFile(content: any, filename: string, filetype: string): Promise<string>; // for uploading larger files
  deleteUploadedFile(fileId: string): Promise<void>;

  saveNestedTagGroups(nestedTagGroups: ParentTagToChildTags);
  saveSettings(settings: UserSettings): Promise<void>;

  addAttachmentToNote(noteId: string, fileId: string, fileName: string, mimeType: string);
  removeAttachmentFromNote(noteId: string, fileId: string);

  logout();
}
