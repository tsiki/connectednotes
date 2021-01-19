import {FlashcardLearningData} from './types';

export const JSON_MIMETYPE = 'application/json';
export const TEXT_MIMETYPE = 'text/plain';

export const DARK_THEME = 'darcula';
export const LIGHT_THEME = 'default';

export const ROOT_TAG_NAME = '(root)';
export const ALL_NOTES_TAG_NAME = 'all';
export const UNTAGGED_NOTES_TAG_NAME = 'untagged';
export const AUTOMATICALLY_GENERATED_TAG_NAMES = [ALL_NOTES_TAG_NAME, UNTAGGED_NOTES_TAG_NAME];

export const ANALYTICS_ENABLED_LOCAL_STORAGE_KEY = 'analyticsEnabled';

export const INITIAL_FLASHCARD_LEARNING_DATA: FlashcardLearningData = Object.freeze({
    easinessFactor: 2.5,
    numRepetitions: 0,
    prevRepetitionEpochMillis: 0,
    prevRepetitionIntervalMillis: 0,
});

// (^|\s) matches whitespace or start of line
// ?![#] ensures that there's only one hashtag before the tag, ignoring stuff like ##asd
// \S is non-whitespace
// ig makes it case insensitive and global
export const TAG_MATCH_REGEX = /(^|\s)(#((?![#])[\S])+)/ig;
