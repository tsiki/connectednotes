
export function sortAscByNumeric<T>(arr: T[], propertyFn: (obj: T) => number) {
    arr.sort((a, b) => propertyFn(a) - propertyFn(b));
}

export function sortAscByString<T>(arr: T[], propertyFn: (obj: T) => string) {
    arr.sort((a, b) => propertyFn(a).localeCompare(propertyFn(b)));
}

export function sortDescByNumeric<T>(arr: T[], propertyFn: (obj: T) => number) {
    arr.sort((a, b) => propertyFn(b) - propertyFn(a));
}

export function sortDescByString<T>(arr: T[], propertyFn: (obj: T) => string) {
    arr.sort((a, b) => propertyFn(b).localeCompare(propertyFn(a)));
}

export function shallowCopy(obj: any) {
    return Object.assign({}, obj);
}

export interface NoteReference {
    index: number; // Index where the actual note title starts
    noteReferenced: string;
}

export function getAllNoteReferences(s: string, existingTitles: Set<string>): NoteReference[] {
    const ans = [];
    for (let idx = s.indexOf('[['); idx !== -1; idx = s.indexOf('[[', idx + 1)) {
        if (idx > 0 && s[idx - 1] === '\\') continue;
        // Just in case there's something like [[[[[title]]
        while (s.length > idx + 1 && s[idx] === '[' && s[idx + 1] === '[') {
            idx++;
        }
        const endIdx = s.indexOf(']]', idx);
        const ref = s.slice(idx + 1, endIdx);
        if (existingTitles.has(ref)) {
            ans.push({index: idx + 1, noteReferenced: s.slice(idx + 1, endIdx)});
        }
    }
    return ans;
}

function getUniqueName(curName: string, existingNames: Set<string>) {
    if (!existingNames.has(curName)) {
        return curName;
    }
    let i = 1;
    while (existingNames.has(curName + ` (${i})`)) {
        i++;
    }
    return curName + ` (${i})`;
}

export function makeNamesUnique(titles: string[], existingNames: Set<string>): string[] {
    const ans = [];
    for (const title of titles) {
        const newTitle = getUniqueName(title, existingNames);
        ans.push(newTitle);
        existingNames.add(newTitle);
    }
    return ans;
}
