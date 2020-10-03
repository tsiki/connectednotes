import { TestBed } from '@angular/core/testing';

import { SubviewManagerService } from './subview-manager.service';

describe('SubviewManagerService', () => {
  let service: SubviewManagerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SubviewManagerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
