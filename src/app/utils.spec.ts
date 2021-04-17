import { TestBed } from '@angular/core/testing';

import * as utils from './utils';

fdescribe('AnalyticsService', () => {

    it('should detect note references', () => {
        const existingTitles = new Set(['qweqwe', 'zxc']);
        const refs = utils.getAllNoteReferences('asdasd [[qweqwe]] qwdsadoqi dss [[zxc]]!', existingTitles);
        expect(refs).toEqual([{index: 9, noteReferenced: 'qweqwe'}, {index: 34, noteReferenced: 'zxc'}]);
    });

    it('should detect only existing note references', () => {
        const existingTitles = new Set(['qweqwe']);
        const refs = utils.getAllNoteReferences('asdasd [[qweqwe]] qwdsadoqi dss [[zxc]]!', existingTitles);
        expect(refs).toEqual([{index: 9, noteReferenced: 'qweqwe'}]);
    });

    it('should detect multiple note references', () => {
        const existingTitles = new Set(['qweqwe', 'zxc']);
        const refs = utils.getAllNoteReferences('asdasd [[qweqwe]] qwdsadoqi dss [[qweqwe]]!', existingTitles);
        expect(refs).toEqual([{index: 9, noteReferenced: 'qweqwe'}, {index: 34, noteReferenced: 'qweqwe'}]);
    });
});
