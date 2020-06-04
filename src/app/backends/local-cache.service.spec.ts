import { TestBed } from '@angular/core/testing';

import { LocalCacheService } from './local-cache.service';

describe('LocalCacheService', () => {
  let service: LocalCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocalCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
