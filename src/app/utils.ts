
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
